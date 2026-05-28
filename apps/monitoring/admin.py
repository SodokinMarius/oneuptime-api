from django.contrib import admin

from apps.monitoring.models import Monitor, MonitorCheck, MonitorGroup, Probe


@admin.register(Probe)
class ProbeAdmin(admin.ModelAdmin):
    list_display = ("name", "location", "is_active", "last_seen_at")
    list_filter = ("is_active",)


@admin.register(Monitor)
class MonitorAdmin(admin.ModelAdmin):
    list_display = ("name", "type", "status", "is_paused", "last_check_at", "project")
    list_filter = ("type", "status", "is_paused")
    search_fields = ("name", "url")
    readonly_fields = ("last_check_at", "next_check_at", "status")


@admin.register(MonitorGroup)
class MonitorGroupAdmin(admin.ModelAdmin):
    list_display = ("name", "project")
    filter_horizontal = ("monitors",)


@admin.register(MonitorCheck)
class MonitorCheckAdmin(admin.ModelAdmin):
    list_display = ("monitor", "checked_at", "status", "response_status_code", "response_time_ms")
    list_filter = ("status",)
    readonly_fields = ("monitor", "probe", "checked_at", "status",
                       "response_status_code", "response_time_ms",
                       "error_message", "triggered_incident")
