"""
Unified authentication: JWT (session) + API Key (Bearer ok_...).

Priority:
  1. If token starts with 'ok_'  → try API Key lookup
  2. Otherwise                   → try JWT validation

Both are tried on every request; the first that succeeds wins.
If neither matches → AnonymousUser (permission classes handle 401).
"""
import hashlib

from django.utils import timezone
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import AuthenticationFailed as JWTAuthFailed
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError


class ActiveVerifiedJWTAuthentication(JWTAuthentication):
    """JWT auth that also enforces account state checks."""

    def get_user(self, validated_token):
        user = super().get_user(validated_token)
        if not user.is_active:
            raise AuthenticationFailed("Account is disabled.", code="account_disabled")
        if not user.is_email_verified:
            raise AuthenticationFailed(
                "Email address is not verified.", code="email_not_verified"
            )
        if user.is_erased:
            raise AuthenticationFailed("Account has been erased.", code="account_erased")
        return user


class UnifiedTokenAuthentication(BaseAuthentication):
    """
    Single authentication class that handles both:
    - API Keys  : Bearer ok_<hex>
    - JWT tokens: Bearer eyJ...

    Usage in REST_FRAMEWORK settings:
        'DEFAULT_AUTHENTICATION_CLASSES': [
            'apps.accounts.authentication.UnifiedTokenAuthentication',
        ]
    """

    _jwt_auth = ActiveVerifiedJWTAuthentication()

    def authenticate(self, request):
        header = request.META.get("HTTP_AUTHORIZATION", "")
        if not header.lower().startswith("bearer "):
            return None  # no credentials → anonymous

        token = header[7:].strip()

        if token.startswith("ok_"):
            return self._authenticate_api_key(token, request)

        return self._authenticate_jwt(token, request)

    def authenticate_header(self, request):
        return 'Bearer realm="oneuptime"'

    # ------------------------------------------------------------------
    # JWT path
    # ------------------------------------------------------------------

    def _authenticate_jwt(self, raw_token: str, request):
        """Delegate to ActiveVerifiedJWTAuthentication."""
        try:
            validated = self._jwt_auth.get_validated_token(
                self._jwt_auth.get_raw_token(
                    f"Bearer {raw_token}".encode()
                )
            )
            user = self._jwt_auth.get_user(validated)
            request.auth_method = validated.get("auth_method", "password")
            request.sso_projects = validated.get("sso_projects", []) or []
            return (user, validated)
        except (InvalidToken, TokenError, JWTAuthFailed) as exc:
            raise AuthenticationFailed(str(exc)) from exc

    # ------------------------------------------------------------------
    # API Key path
    # ------------------------------------------------------------------

    def _authenticate_api_key(self, raw_token: str, request):
        """
        Validate an API key:
        1. Hash the raw token with SHA-256
        2. Look up matching ApiKey (not revoked, not expired)
        3. Touch last_used_at
        4. Return (owner_user, api_key) tuple
        """
        try:
            from apps.rbac.models import ApiKey  # imported lazily — app may not exist yet
        except ImportError:
            raise AuthenticationFailed(
                "API Key authentication is not available yet.", code="api_key_unavailable"
            )

        key_hash = hashlib.sha256(raw_token.encode()).hexdigest()

        try:
            api_key = ApiKey.objects.select_related("created_by").get(
                key_hash=key_hash,
                revoked_at__isnull=True,
            )
        except ApiKey.DoesNotExist:
            raise AuthenticationFailed("Invalid API key.", code="invalid_api_key")

        if api_key.expires_at and api_key.expires_at < timezone.now():
            raise AuthenticationFailed("API key has expired.", code="api_key_expired")

        user = api_key.created_by
        if not user.is_active:
            raise AuthenticationFailed("Account is disabled.", code="account_disabled")

        # Non-blocking update of last_used_at
        ApiKey.objects.filter(pk=api_key.pk).update(last_used_at=timezone.now())

        # Attach api_key to request so views can inspect permissions
        request.api_key = api_key
        return (user, api_key)
