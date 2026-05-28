from django.contrib import admin

from apps.maintenance.models import ScheduledMaintenance


@admin.register(ScheduledMaintenance)
class ScheduledMaintenanceAdmin(admin.ModelAdmin):
    list_display = ("title", "project", "status", "starts_at", "ends_at")
    list_filter = ("status",)
    filter_horizontal = ("monitors",)
