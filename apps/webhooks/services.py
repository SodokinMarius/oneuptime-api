"""
WebhookService — queue and deliver outbound webhook events.

Delivery is processed by the scheduler job (process_webhook_deliveries) every minute.
"""
import hashlib
import hmac
import json
import logging
import secrets
import time
from datetime import timedelta

import requests as http_requests
from django.conf import settings
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

logger = logging.getLogger(__name__)


class WebhookService:
    """
    Entry-point for firing webhook events.

    Usage:
        WebhookService.emit(
            tenant=tenant,
            project=project,
            event_type="incident.created",
            payload={"incident": {...}},
        )
    """

    RETRY_DELAYS = [0, 30, 300, 1800]

    @classmethod
    def emit(cls, tenant, project, event_type: str, payload: dict):
        """Queue deliveries for all webhooks subscribed to event_type."""
        from apps.webhooks.models import DeliveryStatus, Webhook, WebhookDelivery

        try:
            with transaction.atomic():
                hooks = cls._subscribed_webhooks(tenant, project, event_type)
                if not hooks:
                    return

                event_id = f"evt_{secrets.token_hex(12)}"
                now = timezone.now()

                for hook in hooks:
                    body = cls._build_payload(
                        tenant=tenant,
                        project=project,
                        event_type=event_type,
                        event_id=event_id,
                        data=payload,
                        now=now,
                    )
                    WebhookDelivery.objects.create(
                        tenant=tenant,
                        webhook=hook,
                        event_id=event_id,
                        event_type=event_type,
                        payload=body,
                        status=DeliveryStatus.PENDING,
                        next_retry_at=now,
                    )
        except Exception as exc:
            logger.error("WebhookService.emit failed for %s: %s", event_type, exc)

    @classmethod
    def _subscribed_webhooks(cls, tenant, project, event_type: str):
        from apps.webhooks.models import Webhook

        base = Webhook.objects.filter(
            tenant=tenant,
            project=project,
            is_active=True,
        )
        specific = base.filter(event_types__contains=event_type)
        if specific.exists():
            return specific
        return base.filter(event_types__contains="*")

    @classmethod
    def _build_payload(cls, tenant, project, event_type: str, event_id: str, data: dict, now) -> dict:
        return {
            "id": event_id,
            "type": event_type,
            "timestamp": now.isoformat(),
            "projectId": str(project.id),
            "tenantId": str(tenant.id),
            "data": data,
        }

    @staticmethod
    def _sign(secret: str, body: str) -> str:
        return "sha256=" + hmac.new(
            secret.encode(), body.encode(), hashlib.sha256
        ).hexdigest()

    @classmethod
    def process_pending(cls, batch_size: int = 50) -> dict:
        """
        Deliver pending / retry-eligible webhook events.
        Returns counts: sent, failed, exhausted.
        """
        from apps.webhooks.models import DeliveryStatus, WebhookDelivery

        now = timezone.now()
        due = (
            WebhookDelivery.objects.filter(
                status__in=(DeliveryStatus.PENDING, DeliveryStatus.FAILED),
            )
            .filter(Q(next_retry_at__lte=now) | Q(next_retry_at__isnull=True))
            .select_related("webhook")
            .order_by("next_retry_at", "created_at")[:batch_size]
        )

        stats = {"sent": 0, "failed": 0, "exhausted": 0}
        for delivery in due:
            result = cls._deliver_one(delivery)
            stats[result] = stats.get(result, 0) + 1
        return stats

    @classmethod
    def _deliver_one(cls, delivery) -> str:
        from apps.webhooks.models import DeliveryStatus

        hook = delivery.webhook
        if not hook.is_active:
            delivery.status = DeliveryStatus.EXHAUSTED
            delivery.save(update_fields=["status", "updated_at"])
            return "exhausted"

        body_dict = delivery.payload
        body_str = json.dumps(body_dict, separators=(",", ":"), default=str)
        timestamp = str(int(time.time()))
        signature = cls._sign(hook.secret, body_str)

        headers = {
            "Content-Type": "application/json",
            "X-OneUptime-Signature": signature,
            "X-OneUptime-Timestamp": timestamp,
            "X-OneUptime-Event": delivery.event_type,
            "X-OneUptime-Delivery": str(delivery.id),
        }
        headers.update(hook.headers or {})

        timeout = hook.timeout_seconds or settings.WEBHOOK_DEFAULT_TIMEOUT_SECONDS
        start = time.monotonic()
        attempt = delivery.attempt_count + 1

        try:
            resp = http_requests.post(
                hook.url,
                data=body_str,
                headers=headers,
                timeout=timeout,
            )
            duration_ms = int((time.monotonic() - start) * 1000)
            delivery.attempt_count = attempt
            delivery.response_status = resp.status_code
            delivery.response_body = (resp.text or "")[:2000]
            delivery.duration_ms = duration_ms

            if 200 <= resp.status_code < 300:
                delivery.status = DeliveryStatus.SUCCESS
                delivery.delivered_at = timezone.now()
                delivery.next_retry_at = None
                delivery.save(
                    update_fields=[
                        "status",
                        "attempt_count",
                        "response_status",
                        "response_body",
                        "duration_ms",
                        "delivered_at",
                        "next_retry_at",
                        "updated_at",
                    ]
                )
                return "sent"

            cls._schedule_retry(delivery, hook.max_retries, f"HTTP {resp.status_code}")
            return "failed" if delivery.status == DeliveryStatus.FAILED else "exhausted"

        except Exception as exc:
            duration_ms = int((time.monotonic() - start) * 1000)
            delivery.attempt_count = attempt
            delivery.duration_ms = duration_ms
            delivery.response_body = str(exc)[:2000]
            cls._schedule_retry(delivery, hook.max_retries, str(exc))
            return "failed" if delivery.status == DeliveryStatus.FAILED else "exhausted"

    @classmethod
    def _schedule_retry(cls, delivery, max_retries: int, error_msg: str):
        from apps.webhooks.models import DeliveryStatus

        delivery.response_body = (error_msg or "")[:2000]
        if delivery.attempt_count >= max_retries:
            delivery.status = DeliveryStatus.EXHAUSTED
            delivery.next_retry_at = None
        else:
            delay_idx = min(delivery.attempt_count, len(cls.RETRY_DELAYS) - 1)
            delay = cls.RETRY_DELAYS[delay_idx]
            delivery.status = DeliveryStatus.FAILED
            delivery.next_retry_at = timezone.now() + timedelta(seconds=delay)
        delivery.save(
            update_fields=[
                "status",
                "attempt_count",
                "response_status",
                "response_body",
                "duration_ms",
                "next_retry_at",
                "updated_at",
            ]
        )
