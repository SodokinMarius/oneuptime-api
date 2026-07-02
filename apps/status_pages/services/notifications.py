"""Transactional emails and SMS for status page subscribers."""
from datetime import datetime
from email.utils import formataddr

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string

from apps.status_pages.models import StatusPage, StatusPageSubscriber
from core.notifications.sms import SMSService


class SubscriberNotificationService:
    @staticmethod
    def _from_email() -> str:
        name = getattr(settings, "EMAIL_FROM_NAME", "OneUptime")
        address = settings.DEFAULT_FROM_EMAIL or settings.EMAIL_HOST_USER
        return formataddr((name, address))

    @staticmethod
    def _base_context(recipient_email: str) -> dict:
        return {
            "brand_name": getattr(settings, "EMAIL_FROM_NAME", "OneUptime"),
            "recipient_email": recipient_email,
            "year": datetime.now().year,
        }

    @classmethod
    def _send(cls, *, to: str, subject: str, template_name: str, context: dict, plain: str) -> None:
        html_body = render_to_string(template_name, context)
        msg = EmailMultiAlternatives(
            subject=subject,
            body=plain,
            from_email=cls._from_email(),
            to=[to],
        )
        msg.attach_alternative(html_body, "text/html")
        msg.send(fail_silently=False)

    @staticmethod
    def _verification_url(page: StatusPage, path: str, token: str) -> str:
        base = settings.FRONTEND_URL.rstrip("/")
        return f"{base}/status/{page.slug}/{path}?token={token}"

    @classmethod
    def send_email_verification(cls, subscriber: StatusPageSubscriber) -> None:
        page = subscriber.status_page
        verify_url = cls._verification_url(page, "verify-email", subscriber.verification_token)
        brand = getattr(settings, "EMAIL_FROM_NAME", "OneUptime")
        context = {
            **cls._base_context(subscriber.email),
            "status_page_name": page.name,
            "verify_url": verify_url,
        }
        plain = (
            f"Confirm your subscription to {page.name}\n\n"
            f"Open this link to verify your email:\n{verify_url}\n\n"
            f"If you did not subscribe, you can ignore this message."
        )
        cls._send(
            to=subscriber.email,
            subject=f"[{brand}] Confirm your subscription to {page.name}",
            template_name="emails/subscriber_verification.html",
            context=context,
            plain=plain,
        )

    @classmethod
    def send_phone_verification(cls, subscriber: StatusPageSubscriber) -> None:
        if not subscriber.phone:
            return

        page = subscriber.status_page
        brand = getattr(settings, "EMAIL_FROM_NAME", "OneUptime")
        verify_url = cls._verification_url(
            page, "verify-phone", subscriber.phone_verification_token
        )
        body = (
            f"[{brand}] Confirm SMS alerts for {page.name}. "
            f"Open: {verify_url}"
        )

        if not SMSService.send(subscriber.phone, body):
            raise RuntimeError("SMS delivery failed or Twilio is not configured.")
