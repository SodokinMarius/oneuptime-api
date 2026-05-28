"""
drf-spectacular OpenAPI extension for UnifiedTokenAuthentication.

Registers a Bearer security scheme that covers both JWT and API Key tokens.
Auto-discovered when this module is imported in AccountsConfig.ready().
"""
from drf_spectacular.extensions import OpenApiAuthenticationExtension


class UnifiedTokenAuthenticationScheme(OpenApiAuthenticationExtension):
    """
    Maps UnifiedTokenAuthentication to the OpenAPI 'Bearer' security scheme.
    Works for both JWT access tokens and API Keys (ok_live_...).
    """
    target_class = "apps.accounts.authentication.UnifiedTokenAuthentication"
    name = "Bearer"
    priority = 1

    def get_security_definition(self, auto_schema):
        return {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT or API Key (ok_live_...)",
            "description": (
                "Pass a JWT access token **or** an API Key.\n\n"
                "- **JWT**: obtained from `POST /api/v1/auth/login`\n"
                "- **API Key**: obtained from `POST /api/v1/api-keys` — "
                "prefix `ok_live_`\n\n"
                "Both use: `Authorization: Bearer <token>`"
            ),
        }

    def get_security_requirement(self, auto_schema):
        return {self.name: []}
