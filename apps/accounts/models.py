"""
Accounts app - User and UserMembership models.

Maps to OneUptime document §12 (Authentication) and §19 (Users).
"""
import secrets
import uuid

from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models
from django.utils import timezone


class UserManager(BaseUserManager):
    """Custom manager since we use email instead of username."""

    use_in_migrations = True

    def _create_user(self, email, password, **extra_fields):
        if not email:
            raise ValueError("Email is required")
        email = self.normalize_email(email)
        # Username is still required by AbstractUser; derive from email
        extra_fields.setdefault('username', email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', False)
        extra_fields.setdefault('is_superuser', False)
        extra_fields.setdefault('is_active', False)
        extra_fields.setdefault('is_email_verified', False)
        return self._create_user(email, password, **extra_fields)

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('is_active', True)
        extra_fields.setdefault('is_email_verified', True)
        if extra_fields.get('is_staff') is not True:
            raise ValueError("Superuser must have is_staff=True.")
        if extra_fields.get('is_superuser') is not True:
            raise ValueError("Superuser must have is_superuser=True.")
        return self._create_user(email, password, **extra_fields)


class User(AbstractUser):
    """
    Custom User model with UUID primary key and email-based authentication.

    Adds fields required by HIPAA/SOC2 controls:
    - mfa_enabled (HIPAA 164.312(a)(2) — authentication)
    - session_timeout_minutes (HIPAA 164.312(a)(1) — auto-lock)
    - last_login_ip (audit trail)
    """
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )
    email = models.EmailField(unique=True)
    is_email_verified = models.BooleanField(default=False)

    # Compliance fields
    mfa_enabled = models.BooleanField(default=False)
    mfa_secret = models.CharField(max_length=64, blank=True)
    session_timeout_minutes = models.PositiveIntegerField(default=60)
    last_login_ip = models.GenericIPAddressField(null=True, blank=True)

    # GDPR: pseudonymization flag (set when user requests erasure)
    is_erased = models.BooleanField(default=False)
    erased_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']

    objects = UserManager()

    class Meta:
        db_table = 'accounts_user'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['email']),
            models.Index(fields=['-created_at']),
        ]

    def __str__(self):
        return self.email

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}".strip() or self.email


class UserMembership(models.Model):
    """
    Links a User to a Tenant. A user can be member of multiple tenants
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        'accounts.User',
        on_delete=models.CASCADE,
        related_name='memberships',
    )
    tenant = models.ForeignKey(
        'tenancy.Tenant',
        on_delete=models.CASCADE,
        related_name='memberships',
    )
    is_owner = models.BooleanField(default=False)

    invited_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='sent_invitations',
    )
    invitation_token = models.CharField(max_length=64, blank=True)
    invited_at = models.DateTimeField(auto_now_add=True)
    accepted_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'accounts_user_membership'
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'tenant'],
                name='unique_user_per_tenant',
            ),
        ]
        indexes = [
            models.Index(fields=['user', 'tenant']),
            models.Index(fields=['invitation_token']),
        ]

    def __str__(self):
        return f"{self.user.email} @ {self.tenant.name}"

    @property
    def is_accepted(self):
        return self.accepted_at is not None

    @staticmethod
    def generate_invitation_token():
        """Generate a secure URL-safe invitation token."""
        return secrets.token_urlsafe(48)


class OtpPurpose(models.TextChoices):
    ACTIVATION = 'activation', 'Account activation'
    MFA_LOGIN = 'mfa_login', 'MFA login'
    PASSWORD_RESET = 'password_reset', 'Password reset'


class OtpChallenge(models.Model):
    """One-time password challenge (email OTP)."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        'accounts.User',
        on_delete=models.CASCADE,
        related_name='otp_challenges',
    )
    purpose = models.CharField(max_length=32, choices=OtpPurpose.choices)
    code_hash = models.CharField(max_length=128)
    expires_at = models.DateTimeField()
    consumed_at = models.DateTimeField(null=True, blank=True)
    attempts = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'accounts_otp_challenge'
        indexes = [
            models.Index(fields=['user', 'purpose', '-created_at']),
        ]

    @property
    def is_expired(self):
        return timezone.now() >= self.expires_at

    @property
    def is_consumed(self):
        return self.consumed_at is not None


class MfaLoginSession(models.Model):
    """Temporary session between password login and MFA verification."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        'accounts.User',
        on_delete=models.CASCADE,
        related_name='mfa_login_sessions',
    )
    token = models.CharField(max_length=64, unique=True, db_index=True)
    expires_at = models.DateTimeField()
    consumed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'accounts_mfa_login_session'

    @property
    def is_expired(self):
        return timezone.now() >= self.expires_at

    @property
    def is_consumed(self):
        return self.consumed_at is not None