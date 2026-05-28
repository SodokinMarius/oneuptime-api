from django.contrib import admin

from apps.webhooks.models import Webhook, WebhookDelivery


@admin.register(Webhook)
class WebhookAdmin(admin.ModelAdmin):
    list_display = ("name", "url", "is_active", "project")
    list_filter = ("is_active",)


@admin.register(WebhookDelivery)
class WebhookDeliveryAdmin(admin.ModelAdmin):
    list_display = ("event_type", "webhook", "status", "attempt_count", "created_at")
    list_filter = ("status", "event_type")
    readonly_fields = ("event_id", "payload", "response_body", "created_at")
