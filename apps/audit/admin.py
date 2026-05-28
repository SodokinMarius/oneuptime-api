from django.contrib import admin

from apps.audit.models import AuditLog, RetentionPolicy


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ("id", "action", "actor_type", "resource_type", "tenant", "created_at")
    list_filter = ("actor_type", "resource_type")
    search_fields = ("action", "resource_type")
    readonly_fields = tuple(f.name for f in AuditLog._meta.fields)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(RetentionPolicy)
class RetentionPolicyAdmin(admin.ModelAdmin):
    list_display = ("project", "data_type", "retention_days", "archive_to_s3")
