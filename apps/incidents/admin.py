from django.contrib import admin

from apps.incidents.models import (
    Incident,
    IncidentNote,
    IncidentPostmortem,
    IncidentSeverity,
    IncidentState,
)


@admin.register(IncidentState)
class IncidentStateAdmin(admin.ModelAdmin):
    list_display = ("name", "project", "order", "is_resolved_state", "is_system")
    list_filter = ("is_system", "is_resolved_state")


@admin.register(IncidentSeverity)
class IncidentSeverityAdmin(admin.ModelAdmin):
    list_display = ("name", "project", "order", "is_system")
    list_filter = ("is_system",)


@admin.register(Incident)
class IncidentAdmin(admin.ModelAdmin):
    list_display = ("title", "project", "state", "severity", "triggered_at", "resolved_at")
    list_filter = ("state", "severity")
    search_fields = ("title",)
    readonly_fields = ("triggered_at", "acknowledged_at", "resolved_at")


@admin.register(IncidentNote)
class IncidentNoteAdmin(admin.ModelAdmin):
    list_display = ("incident", "author", "is_public", "created_at")


@admin.register(IncidentPostmortem)
class IncidentPostmortemAdmin(admin.ModelAdmin):
    list_display = ("incident", "published_at")
