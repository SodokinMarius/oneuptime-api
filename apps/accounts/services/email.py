"""Transactional emails with HTML templates."""
from datetime import datetime
from email.utils import formataddr
from urllib.parse import quote

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string


class AuthEmailService:
    @staticmethod
    def _from_email() -> str:
        name = getattr(settings, 'EMAIL_FROM_NAME', 'OneUptime')
        address = settings.DEFAULT_FROM_EMAIL or settings.EMAIL_HOST_USER
        return formataddr((name, address))

    @staticmethod
    def _format_code(code: str) -> str:
        """123456 → 123 456 for readability."""
        code = code.strip().replace(' ', '')
        if len(code) == 6:
            return f'{code[:3]} {code[3:]}'
        return code

    @staticmethod
    def _base_context(recipient_email: str) -> dict:
        return {
            'brand_name': getattr(settings, 'EMAIL_FROM_NAME', 'OneUptime'),
            'recipient_email': recipient_email,
            'year': datetime.now().year,
            'expiry_minutes': settings.OTP_EXPIRY_MINUTES,
            'max_attempts': settings.OTP_MAX_ATTEMPTS,
        }

    @classmethod
    def _send_html_email(
        cls,
        *,
        to: str,
        subject: str,
        template_name: str,
        context: dict,
        plain_fallback: str,
    ) -> None:
        html_body = render_to_string(template_name, context)
        msg = EmailMultiAlternatives(
            subject=subject,
            body=plain_fallback,
            from_email=cls._from_email(),
            to=[to],
        )
        msg.attach_alternative(html_body, 'text/html')
        msg.send(fail_silently=False)

    @classmethod
    def send_activation_otp(cls, email: str, code: str) -> None:
        activation_url = (
            f'{settings.FRONTEND_URL}/activate'
            f'?email={quote(email)}&code={code}'
        )
        context = {
            **cls._base_context(email),
            'code_display': cls._format_code(code),
            'activation_url': activation_url,
        }
        plain = (
            f'Activez votre compte {context["brand_name"]}\n\n'
            f'Code : {code}\n'
            f'Expire dans {settings.OTP_EXPIRY_MINUTES} minutes.\n\n'
            f'Lien : {activation_url}\n\n'
            f'Trop de tentatives ? POST /api/v1/auth/resend-activation'
        )
        cls._send_html_email(
            to=email,
            subject=f'[{context["brand_name"]}] Activez votre compte',
            template_name='emails/activation.html',
            context=context,
            plain_fallback=plain,
        )

    @classmethod
    def send_password_reset_otp(cls, email: str, code: str) -> None:
        reset_url = (
            f'{settings.FRONTEND_URL}/reset-password'
            f'?email={quote(email)}&code={code}'
        )
        context = {
            **cls._base_context(email),
            'code_display': cls._format_code(code),
            'reset_url': reset_url,
        }
        plain = (
            f'Réinitialisation {context["brand_name"]}\n\n'
            f'Code : {code}\n'
            f'Expire dans {settings.OTP_EXPIRY_MINUTES} minutes.\n\n'
            f'Lien : {reset_url}'
        )
        cls._send_html_email(
            to=email,
            subject=f'[{context["brand_name"]}] Réinitialisation du mot de passe',
            template_name='emails/password_reset.html',
            context=context,
            plain_fallback=plain,
        )
