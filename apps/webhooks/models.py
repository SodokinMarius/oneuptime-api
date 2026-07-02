"""
Webhooks app — Webhook, WebhookDelivery.

Maps to OneUptime document §21 (Webhooks & Event System).
"""
import uuid

from django.db import models


class DeliveryStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    SUCCESS = "success", "Success"
    FAILED = "failed", "Failed"
    EXHAUSTED = "exhausted", "Exhausted (max retries)"


class Webhook(models.Model):
    """
    An outbound webhook endpoint subscribed to one or more event types.
    Payloads are signed with HMAC-SHA256 using the stored secret.
    """

    class PayloadFormat(models.TextChoices):
        JSON = "json", "JSON (default)"
        SLACK = "slack", "Slack Incoming Webhook"
        TEAMS = "teams", "Microsoft Teams Connector"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(
        "tenancy.Tenant", on_delete=models.CASCADE, related_name="webhooks"
    )
    project = models.ForeignKey(
        "tenancy.Project", on_delete=models.CASCADE, related_name="webhooks"
    )
    team = models.ForeignKey(
        "rbac.Team",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="webhooks",
    )

    name = models.CharField(max_length=200)
    url = models.URLField(max_length=2048)
    secret = models.CharField(max_length=64)
    payload_format = models.CharField(
        max_length=20,
        choices=PayloadFormat.choices,
        default=PayloadFormat.JSON,
    )
    event_types = models.JSONField(default=list)
    is_active = models.BooleanField(default=True)
    headers = models.JSONField(default=dict)
    timeout_seconds = models.PositiveSmallIntegerField(default=5)
    max_retries = models.PositiveSmallIntegerField(default=4)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = "webhooks"
        db_table = "webhooks_webhook"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["tenant", "project"]),
            models.Index(fields=["is_active"]),
        ]

    def __str__(self):
        return f"{self.name} → {self.url}"


class WebhookDelivery(models.Model):
    """
    A single delivery attempt (and its retries) for a webhook event.
    Retry schedule: immediate → 30s → 5min → 30min → exhausted.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(
        "tenancy.Tenant", on_delete=models.CASCADE, related_name="webhook_deliveries"
    )
    webhook = models.ForeignKey(Webhook, on_delete=models.CASCADE, related_name="deliveries")

    event_id = models.CharField(max_length=32, db_index=True)
    event_type = models.CharField(max_length=100)
    payload = models.JSONField()

    response_status = models.PositiveSmallIntegerField(null=True, blank=True)
    response_body = models.TextField(blank=True)
    attempt_count = models.PositiveSmallIntegerField(default=0)
    status = models.CharField(
        max_length=20, choices=DeliveryStatus.choices, default=DeliveryStatus.PENDING
    )
    next_retry_at = models.DateTimeField(null=True, blank=True, db_index=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
    duration_ms = models.PositiveIntegerField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = "webhooks"
        db_table = "webhooks_delivery"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["webhook", "-created_at"]),
            models.Index(fields=["status", "next_retry_at"]),
        ]

    def __str__(self):
        return f"{self.event_type} → {self.webhook.url} [{self.status}]"
