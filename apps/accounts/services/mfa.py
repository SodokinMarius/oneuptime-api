"""TOTP MFA helpers."""
import secrets
from datetime import timedelta

import pyotp
from django.conf import settings
from django.utils import timezone

from apps.accounts.models import MfaLoginSession, User


class MfaService:
    @staticmethod
    def generate_secret() -> str:
        return pyotp.random_base32()

    @staticmethod
    def provisioning_uri(user: User, secret: str) -> str:
        totp = pyotp.TOTP(secret)
        return totp.provisioning_uri(
            name=user.email,
            issuer_name=settings.MFA_ISSUER_NAME,
        )

    @staticmethod
    def verify_code(secret: str, code: str) -> bool:
        if not secret or not code:
            return False
        totp = pyotp.TOTP(secret)
        return totp.verify(code, valid_window=1)

    @classmethod
    def create_login_session(cls, user: User) -> MfaLoginSession:
        MfaLoginSession.objects.filter(
            user=user,
            consumed_at__isnull=True,
        ).update(consumed_at=timezone.now())

        return MfaLoginSession.objects.create(
            user=user,
            token=secrets.token_urlsafe(32),
            expires_at=timezone.now() + timedelta(
                minutes=settings.MFA_LOGIN_SESSION_MINUTES
            ),
        )

    @classmethod
    def consume_login_session(cls, token: str) -> MfaLoginSession:
        session = MfaLoginSession.objects.filter(
            token=token,
            consumed_at__isnull=True,
        ).select_related('user').first()
        if not session:
            raise ValueError('Invalid MFA session.')
        if session.is_expired:
            raise ValueError('MFA session has expired.')
        session.consumed_at = timezone.now()
        session.save(update_fields=['consumed_at'])
        return session
