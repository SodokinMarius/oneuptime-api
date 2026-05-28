from django.contrib import admin

from apps.status_pages.models import (
    StatusPage,
    StatusPageAnnouncement,
    StatusPageResource,
    StatusPageSubscriber,
)


@admin.register(StatusPage)
class StatusPageAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "is_public", "project")
    search_fields = ("name", "slug")


@admin.register(StatusPageResource)
class StatusPageResourceAdmin(admin.ModelAdmin):
    list_display = ("status_page", "display_name", "order")


@admin.register(StatusPageSubscriber)
class StatusPageSubscriberAdmin(admin.ModelAdmin):
    list_display = ("email", "status_page", "is_verified")


@admin.register(StatusPageAnnouncement)
class StatusPageAnnouncementAdmin(admin.ModelAdmin):
    list_display = ("title", "status_page", "is_active", "starts_at")
