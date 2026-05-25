"""OpenAPI extensions for drf-spectacular (Swagger JWT Authorize button)."""
from drf_spectacular.contrib.rest_framework_simplejwt import SimpleJWTScheme

from apps.accounts.authentication import ActiveVerifiedJWTAuthentication


class ActiveVerifiedJWTScheme(SimpleJWTScheme):
    """Expose Bearer JWT auth in Swagger UI for our custom JWT class."""

    target_class = ActiveVerifiedJWTAuthentication
    name = 'jwtAuth'
