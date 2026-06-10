from django.contrib import admin

from apps.sso.models import SCIMSyncLog, SSOConfig


@admin.register(SSOConfig)
class SSOConfigAdmin(admin.ModelAdmin):
    list_display = ["name", "project", "provider", "is_enabled", "enforce_sso", "created_at"]
    list_filter = ["provider", "is_enabled", "enforce_sso"]
    search_fields = ["name", "project__name", "entity_id"]
    readonly_fields = ["scim_token", "created_at", "updated_at"]
    filter_horizontal = ["default_teams"]


@admin.register(SCIMSyncLog)
class SCIMSyncLogAdmin(admin.ModelAdmin):
    list_display = ["operation", "resource", "external_id", "status", "created_at"]
    list_filter = ["operation", "resource", "status"]
    readonly_fields = [f.name for f in SCIMSyncLog._meta.fields]
