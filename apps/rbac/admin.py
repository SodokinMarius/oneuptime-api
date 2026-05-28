from django.contrib import admin

from apps.rbac.models import ApiKey, Role, Team, TeamMembership


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ("name", "project", "is_system")
    list_filter = ("is_system",)
    search_fields = ("name",)


@admin.register(Team)
class TeamAdmin(admin.ModelAdmin):
    list_display = ("name", "project")
    search_fields = ("name",)


@admin.register(TeamMembership)
class TeamMembershipAdmin(admin.ModelAdmin):
    list_display = ("user", "team", "role")
    raw_id_fields = ("user", "team", "role", "granted_by")


@admin.register(ApiKey)
class ApiKeyAdmin(admin.ModelAdmin):
    list_display = ("name", "key_prefix", "project", "is_active", "last_used_at")
    readonly_fields = ("key_hash", "key_prefix", "last_used_at", "created_at")
