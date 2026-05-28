"""Serializers for audit resources."""
from rest_framework import serializers

from apps.audit.models import AuditLog, DataType, RetentionPolicy


class AuditLogSerializer(serializers.ModelSerializer):
    project_name = serializers.CharField(source="project.name", read_only=True, default=None)

    class Meta:
        model = AuditLog
        fields = (
            "id", "actor_id", "actor_type", "action",
            "resource_type", "resource_id",
            "old_value", "new_value",
            "ip_address", "user_agent",
            "prev_hash", "record_hash",
            "project_name",
            "created_at",
        )
        read_only_fields = fields


class RetentionPolicySerializer(serializers.ModelSerializer):
    data_type_display = serializers.CharField(source="get_data_type_display", read_only=True)

    class Meta:
        model = RetentionPolicy
        fields = (
            "id", "data_type", "data_type_display",
            "retention_days", "archive_to_s3", "s3_bucket",
            "created_at", "updated_at",
        )
        read_only_fields = ("id", "data_type_display", "created_at", "updated_at")

    def validate_data_type(self, value):
        valid = [choice[0] for choice in DataType.choices]
        if value not in valid:
            raise serializers.ValidationError(
                f"Invalid data type. Choose from: {', '.join(valid)}"
            )
        return value

    def validate_retention_days(self, value):
        if value < 1:
            raise serializers.ValidationError("retention_days must be at least 1.")
        return value
