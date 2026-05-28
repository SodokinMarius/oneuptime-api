"""Serializers for scheduled maintenance."""
from rest_framework import serializers

from apps.maintenance.models import MaintenanceStatus, ScheduledMaintenance


class ScheduledMaintenanceSerializer(serializers.ModelSerializer):
    class Meta:
        model = ScheduledMaintenance
        fields = (
            "id", "title", "description",
            "starts_at", "ends_at",
            "monitors", "status",
            "is_visible_on_status_page",
            "notify_subscribers",
            "created_at", "updated_at",
        )
        read_only_fields = ("id", "status", "created_at", "updated_at")

    def validate(self, attrs):
        starts = attrs.get("starts_at", getattr(self.instance, "starts_at", None))
        ends = attrs.get("ends_at", getattr(self.instance, "ends_at", None))
        if starts and ends and ends <= starts:
            raise serializers.ValidationError(
                {"ends_at": "ends_at must be after starts_at."}
            )
        return attrs
