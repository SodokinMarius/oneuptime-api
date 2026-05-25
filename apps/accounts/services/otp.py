"""OTP generation and verification."""
import hashlib
import secrets
from datetime import timedelta

from django.conf import settings
from django.utils import timezone

from apps.accounts.exceptions import OtpError
from apps.accounts.models import OtpChallenge, OtpPurpose, User


class OtpService:
    @classmethod
    def max_attempts(cls) -> int:
        return getattr(settings, 'OTP_MAX_ATTEMPTS', 5)

    @staticmethod
    def _hash_code(code: str) -> str:
        return hashlib.sha256(
            f"{settings.SECRET_KEY}:{code}".encode()
        ).hexdigest()

    @staticmethod
    def generate_code(length: int | None = None) -> str:
        length = length or settings.OTP_LENGTH
        upper = 10 ** length - 1
        return str(secrets.randbelow(upper + 1)).zfill(length)

    @classmethod
    def create_challenge(cls, user: User, purpose: str) -> tuple[OtpChallenge, str]:
        """Invalidate previous challenges and create a new OTP."""
        OtpChallenge.objects.filter(
            user=user,
            purpose=purpose,
            consumed_at__isnull=True,
        ).update(consumed_at=timezone.now())

        code = cls.generate_code()
        challenge = OtpChallenge.objects.create(
            user=user,
            purpose=purpose,
            code_hash=cls._hash_code(code),
            expires_at=timezone.now() + timedelta(minutes=settings.OTP_EXPIRY_MINUTES),
        )
        return challenge, code

    @classmethod
    def _get_active_challenge(cls, user: User, purpose: str) -> OtpChallenge | None:
        return (
            OtpChallenge.objects.filter(
                user=user,
                purpose=purpose,
                consumed_at__isnull=True,
            )
            .order_by('-created_at')
            .first()
        )

    @classmethod
    def _resend_action(cls, purpose: str) -> str:
        if purpose == OtpPurpose.ACTIVATION:
            return 'resend_activation'
        if purpose == OtpPurpose.PASSWORD_RESET:
            return 'resend_password_reset'
        return 'resend_otp'

    @classmethod
    def verify(cls, user: User, purpose: str, code: str) -> OtpChallenge:
        challenge = cls._get_active_challenge(user, purpose)
        action = cls._resend_action(purpose)

        if not challenge:
            raise OtpError(
                'otp_not_found',
                'Aucun code actif. Demandez un nouveau code.',
                action=action,
            )
        if challenge.is_expired:
            raise OtpError(
                'otp_expired',
                'Le code a expiré. Demandez un nouveau code.',
                action=action,
            )
        if challenge.attempts >= cls.max_attempts():
            raise OtpError(
                'otp_locked',
                'Trop de tentatives incorrectes. Demandez un nouveau code.',
                action=action,
            )

        if cls._hash_code(code) != challenge.code_hash:
            challenge.attempts += 1
            challenge.save(update_fields=['attempts'])
            remaining = max(0, cls.max_attempts() - challenge.attempts)

            if remaining == 0:
                raise OtpError(
                    'otp_locked',
                    'Trop de tentatives incorrectes. Demandez un nouveau code.',
                    attempts_remaining=0,
                    action=action,
                )
            raise OtpError(
                'otp_invalid',
                f'Code incorrect. Il vous reste {remaining} tentative(s).',
                attempts_remaining=remaining,
            )

        challenge.consumed_at = timezone.now()
        challenge.save(update_fields=['consumed_at'])
        return challenge
