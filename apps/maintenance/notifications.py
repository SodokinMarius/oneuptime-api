"""Email notifications for status page subscribers during maintenance."""
from datetime import datetime
from email.utils import formataddr

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string

from apps.maintenance.services import status_pages_for_maintenance
from apps.status_pages.models import StatusPageSubscriber


class MaintenanceNotificationService:
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
    def _status_page_url(cls, slug: str) -> str:
        base = settings.FRONTEND_URL.rstrip("/")
        return f"{base}/status/{slug}"

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

    @classmethod
    def _subscriber_emails(cls, maintenance):
        pages = status_pages_for_maintenance(maintenance)
        if not pages.exists():
            return []
        return list(
            StatusPageSubscriber.objects.filter(
                status_page__in=pages,
                is_verified=True,
            )
            .values_list("email", flat=True)
            .distinct()
        )

    @classmethod
    def _subscriber_phones(cls, maintenance):
        pages = status_pages_for_maintenance(maintenance)
        if not pages.exists():
            return []
        return list(
            StatusPageSubscriber.objects.filter(
                status_page__in=pages,
                phone_verified=True,
            )
            .exclude(phone="")
            .values_list("phone", flat=True)
            .distinct()
        )

    @classmethod
    def _notify_sms(cls, maintenance, message: str) -> None:
        from core.notifications.sms import SMSService

        for phone in cls._subscriber_phones(maintenance):
            SMSService.send(phone, message)

    @classmethod
    def _brand_name(cls) -> str:
        return getattr(settings, "EMAIL_FROM_NAME", "OneUptime")

    @classmethod
    def notify_started(cls, maintenance) -> None:
        pages = list(status_pages_for_maintenance(maintenance))
        status_page_url = cls._status_page_url(pages[0].slug) if pages else settings.FRONTEND_URL
        brand = cls._brand_name()
        for email in cls._subscriber_emails(maintenance):
            context = {
                **cls._base_context(email),
                "maintenance_title": maintenance.title,
                "maintenance_description": maintenance.description,
                "starts_at": maintenance.starts_at,
                "ends_at": maintenance.ends_at,
                "status_page_url": status_page_url,
            }
            plain = (
                f"Maintenance planifiée — {maintenance.title}\n\n"
                f"Début : {maintenance.starts_at}\n"
                f"Fin prévue : {maintenance.ends_at}\n\n"
                f"{maintenance.description}\n\n"
                f"Status page : {status_page_url}"
            )
            cls._send(
                to=email,
                subject=f"[{brand}] Maintenance en cours : {maintenance.title}",
                template_name="emails/maintenance_started.html",
                context=context,
                plain=plain,
            )
        sms_body = (
            f"[{brand}] Maintenance en cours: {maintenance.title}. "
            f"Fin prévue: {maintenance.ends_at}"
        )
        cls._notify_sms(maintenance, sms_body)

    @classmethod
    def notify_ended(cls, maintenance) -> None:
        pages = list(status_pages_for_maintenance(maintenance))
        status_page_url = cls._status_page_url(pages[0].slug) if pages else settings.FRONTEND_URL
        brand = cls._brand_name()
        for email in cls._subscriber_emails(maintenance):
            context = {
                **cls._base_context(email),
                "maintenance_title": maintenance.title,
                "ends_at": maintenance.ends_at,
                "status_page_url": status_page_url,
            }
            plain = (
                f"Maintenance terminée — {maintenance.title}\n\n"
                f"Fin : {maintenance.ends_at}\n\n"
                f"Status page : {status_page_url}"
            )
            cls._send(
                to=email,
                subject=f"[{brand}] Maintenance terminée : {maintenance.title}",
                template_name="emails/maintenance_ended.html",
                context=context,
                plain=plain,
            )
        cls._notify_sms(
            maintenance,
            f"[{brand}] Maintenance terminée: {maintenance.title}",
        )
