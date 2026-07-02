"""Status page subscriber signup and verification (email + optional SMS)."""
from __future__ import annotations

import logging
import re
import secrets
from dataclasses import dataclass

from django.core.exceptions import ValidationError

from apps.status_pages.models import StatusPage, StatusPageSubscriber
from apps.status_pages.services.notifications import SubscriberNotificationService

logger = logging.getLogger(__name__)

PHONE_RE = re.compile(r"^\+[1-9]\d{7,14}$")


@dataclass
class SubscribeResult:
    subscriber: StatusPageSubscriber
    created: bool
    email_verification_sent: bool
    phone_verification_sent: bool


class SubscriberService:
    @staticmethod
    def normalize_phone(value: str | None) -> str:
        if not value:
            return ""
        cleaned = re.sub(r"[\s\-().]", "", value.strip())
        if not cleaned:
            return ""
        if not cleaned.startswith("+"):
            raise ValidationError(
                "Phone number must be in international E.164 format (e.g. +33612345678)."
            )
        if not PHONE_RE.match(cleaned):
            raise ValidationError("Invalid phone number format.")
        return cleaned

    @classmethod
    def subscribe(
        cls,
        page: StatusPage,
        *,
        email: str,
        phone: str | None = None,
    ) -> SubscribeResult:
        normalized_phone = cls.normalize_phone(phone)
        email_verification_sent = False
        phone_verification_sent = False

        subscriber, created = StatusPageSubscriber.objects.get_or_create(
            status_page=page,
            email=email,
            defaults={
                "tenant": page.tenant,
                "verification_token": secrets.token_urlsafe(32),
                "is_verified": False,
                "phone": normalized_phone,
                "phone_verified": False,
                "phone_verification_token": (
                    secrets.token_urlsafe(32) if normalized_phone else ""
                ),
            },
        )

        update_fields: list[str] = []

        if not created and subscriber.is_verified:
            phone_unchanged = (not normalized_phone) or normalized_phone == subscriber.phone
            if phone_unchanged and (not normalized_phone or subscriber.phone_verified):
                return SubscribeResult(subscriber, False, False, False)

            if normalized_phone and normalized_phone != subscriber.phone:
                subscriber.phone = normalized_phone
                subscriber.phone_verified = False
                subscriber.phone_verification_token = secrets.token_urlsafe(32)
                update_fields.extend(["phone", "phone_verified", "phone_verification_token"])

        if not subscriber.is_verified:
            if not subscriber.verification_token:
                subscriber.verification_token = secrets.token_urlsafe(32)
                update_fields.append("verification_token")
            try:
                SubscriberNotificationService.send_email_verification(subscriber)
                email_verification_sent = True
            except Exception as exc:
                logger.warning("Email verification failed for %s: %s", email, exc)

        if subscriber.phone and not subscriber.phone_verified:
            if not subscriber.phone_verification_token:
                subscriber.phone_verification_token = secrets.token_urlsafe(32)
                update_fields.append("phone_verification_token")
            try:
                SubscriberNotificationService.send_phone_verification(subscriber)
                phone_verification_sent = True
            except Exception as exc:
                logger.warning("Phone verification failed for %s: %s", subscriber.phone, exc)

        if update_fields:
            subscriber.save(update_fields=update_fields)

        return SubscribeResult(
            subscriber=subscriber,
            created=created,
            email_verification_sent=email_verification_sent,
            phone_verification_sent=phone_verification_sent,
        )

    @classmethod
    def verify_email(cls, page: StatusPage, token: str) -> StatusPageSubscriber:
        token = (token or "").strip()
        if not token:
            raise ValidationError("Verification token is required.")

        try:
            subscriber = StatusPageSubscriber.objects.get(
                status_page=page,
                verification_token=token,
            )
        except StatusPageSubscriber.DoesNotExist as exc:
            raise ValidationError("Invalid or expired verification token.") from exc

        subscriber.is_verified = True
        subscriber.verification_token = ""
        subscriber.save(update_fields=["is_verified", "verification_token"])
        return subscriber

    @classmethod
    def verify_phone(cls, page: StatusPage, token: str) -> StatusPageSubscriber:
        token = (token or "").strip()
        if not token:
            raise ValidationError("Verification token is required.")

        try:
            subscriber = StatusPageSubscriber.objects.get(
                status_page=page,
                phone_verification_token=token,
            )
        except StatusPageSubscriber.DoesNotExist as exc:
            raise ValidationError("Invalid or expired phone verification token.") from exc

        if not subscriber.phone:
            raise ValidationError("No phone number on this subscription.")

        subscriber.phone_verified = True
        subscriber.phone_verification_token = ""
        subscriber.save(update_fields=["phone_verified", "phone_verification_token"])
        return subscriber
