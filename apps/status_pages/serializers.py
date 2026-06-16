"""Serializers for status_pages resources."""
from django.db import models
from django.utils import timezone
from rest_framework import serializers

from core.serializers import TeamScopeSerializerMixin

from apps.status_pages.models import (
    StatusPage,
    StatusPageAnnouncement,
    StatusPageResource,
    StatusPageSubscriber,
)


class StatusPageResourceSerializer(serializers.ModelSerializer):
    monitor_name = serializers.CharField(source="monitor.name", read_only=True, default=None)
    monitor_status = serializers.CharField(source="monitor.status", read_only=True, default=None)
    group_name = serializers.CharField(
        source="monitor_group.name", read_only=True, default=None
    )

    class Meta:
        model = StatusPageResource
        fields = (
            "id", "monitor", "monitor_group",
            "display_name", "order",
            "monitor_name", "monitor_status", "group_name",
            "created_at",
        )
        read_only_fields = ("id", "monitor_name", "monitor_status", "group_name", "created_at")

    def validate(self, attrs):
        monitor = attrs.get("monitor")
        group = attrs.get("monitor_group")
        if not monitor and not group:
            raise serializers.ValidationError(
                "Either monitor or monitor_group must be provided."
            )
        if monitor and group:
            raise serializers.ValidationError(
                "Provide either monitor or monitor_group, not both."
            )
        return attrs


class StatusPageAnnouncementSerializer(serializers.ModelSerializer):
    message = serializers.CharField(source="content", write_only=True, required=False, allow_blank=True)

    class Meta:
        model = StatusPageAnnouncement
        fields = (
            "id", "title", "content", "message",
            "starts_at", "ends_at", "is_active",
            "created_at", "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")
        extra_kwargs = {
            "content": {"required": False},
            "starts_at": {"required": False},
        }

    def validate(self, attrs):
        if not attrs.get("content") and not (self.instance and self.instance.content):
            raise serializers.ValidationError({"content": "This field is required."})
        if not attrs.get("starts_at") and not (self.instance and self.instance.starts_at):
            attrs["starts_at"] = timezone.now()
        starts = attrs.get("starts_at") or (self.instance.starts_at if self.instance else None)
        ends = attrs.get("ends_at") or (self.instance.ends_at if self.instance else None)
        if starts and ends and ends <= starts:
            raise serializers.ValidationError("ends_at must be after starts_at.")
        return attrs


class StatusPageSubscriberSerializer(serializers.ModelSerializer):
    class Meta:
        model = StatusPageSubscriber
        fields = ("id", "email", "is_verified", "subscribed_at")
        read_only_fields = ("id", "is_verified", "subscribed_at")


class StatusPageSerializer(TeamScopeSerializerMixin, serializers.ModelSerializer):
    resources = StatusPageResourceSerializer(many=True, read_only=True)
    subscribers_count = serializers.SerializerMethodField()

    class Meta:
        model = StatusPage
        fields = (
            "id", "name", "slug", "is_public", "custom_domain",
            "logo_url", "primary_color", "custom_css", "description",
            "team_id", "team_name",
            "resources", "subscribers_count",
            "created_at", "updated_at",
        )
        read_only_fields = ("id", "resources", "subscribers_count", "created_at", "updated_at")

    def get_subscribers_count(self, obj) -> int:
        return obj.subscribers.filter(is_verified=True).count()


class StatusPagePublicSerializer(serializers.ModelSerializer):
    """
    Public view of a status page — no authentication required.
    Includes only active/visible data. Subscriber emails are never exposed.
    """
    resources = StatusPageResourceSerializer(many=True, read_only=True)
    announcements = serializers.SerializerMethodField()

    class Meta:
        model = StatusPage
        fields = (
            "id", "name", "slug", "description",
            "logo_url", "primary_color", "custom_css",
            "resources", "announcements",
        )

    def get_announcements(self, obj):
        now = timezone.now()
        qs = obj.announcements.filter(
            is_active=True,
            starts_at__lte=now,
        ).filter(
            models.Q(ends_at__isnull=True) | models.Q(ends_at__gte=now)
        ).order_by("-starts_at")
        return StatusPageAnnouncementSerializer(qs, many=True).data
