"""
SCIM bearer token authentication.

Authenticates requests to /scim/v2/ using the scim_token on SSOConfig.
Sets request.sso_config for downstream views.
"""
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed

from apps.sso.models import SSOConfig


class SCIMAuthentication(BaseAuthentication):
    """Validate Authorization: Bearer <scim_token> header."""

    keyword = "Bearer"

    def authenticate(self, request):
        auth_header = request.META.get("HTTP_AUTHORIZATION", "")
        if not auth_header.startswith(f"{self.keyword} "):
            return None

        token = auth_header[len(self.keyword) + 1 :].strip()
        if not token:
            raise AuthenticationFailed("Invalid SCIM bearer token")

        config = SSOConfig.objects.filter(
            scim_token=token, is_enabled=True
        ).select_related("project", "tenant", "default_role").first()

        if config is None:
            raise AuthenticationFailed("Invalid SCIM bearer token")

        request.sso_config = config
        # SCIM is a machine-to-machine protocol — no user principal
        return (None, config)
