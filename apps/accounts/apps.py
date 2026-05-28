from django.apps import AppConfig


class AccountsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.accounts"
    label = "accounts"

    def ready(self):
        import apps.accounts.schema  # noqa: F401 — register OpenAPI JWT scheme
        import core.spectacular  # noqa: F401 — register UnifiedTokenAuthentication OpenAPI extension
