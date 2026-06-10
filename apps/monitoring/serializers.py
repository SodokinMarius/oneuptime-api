"""Serializers for monitoring resources."""
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.monitoring.models import Monitor, MonitorCheck, MonitorGroup, MonitorType, Probe
from core.serializers import TeamScopeSerializerMixin


class ProbeSerializer(serializers.ModelSerializer):
    is_online = serializers.SerializerMethodField()

    class Meta:
        model = Probe
        fields = ("id", "name", "location", "is_active", "is_online", "last_seen_at", "version")
        read_only_fields = fields

    @extend_schema_field(serializers.BooleanField())
    def get_is_online(self, obj) -> bool:
        if not obj.last_seen_at:
            return False
        from django.utils import timezone
        from datetime import timedelta
        return (timezone.now() - obj.last_seen_at) < timedelta(minutes=5)


class MonitorSerializer(TeamScopeSerializerMixin, serializers.ModelSerializer):
    class Meta:
        model = Monitor
        fields = (
            "id", "name", "type", "url", "method",
            "interval_seconds", "timeout_seconds", "retries",
            "probe_locations", "criteria", "headers", "body",
            "alert_on_failure", "is_paused", "status", "tags",
            "team_id", "team_name",
            "current_incident", "last_check_at", "next_check_at",
            "created_at", "updated_at",
        )
        read_only_fields = (
            "id", "status", "current_incident",
            "last_check_at", "next_check_at",
            "created_at", "updated_at",
        )

    def validate_type(self, value):
        valid = [c[0] for c in MonitorType.choices]
        if value not in valid:
            raise serializers.ValidationError(
                f"Invalid type '{value}'. Valid types: {valid}"
            )
        return value

    def validate_method(self, value):
        allowed = ("GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS")
        if value.upper() not in allowed:
            raise serializers.ValidationError(
                f"Invalid HTTP method '{value}'."
            )
        return value.upper()

    def validate(self, attrs):
        mtype = attrs.get("type", getattr(self.instance, "type", None))
        url = attrs.get("url", getattr(self.instance, "url", ""))
        if mtype in ("api", "website") and not url:
            raise serializers.ValidationError(
                {"url": "URL is required for api/website monitor types."}
            )
        if mtype == "tcp" and not url:
            raise serializers.ValidationError(
                {"url": "TCP target (host:port) is required for tcp monitor type."}
            )
        return attrs


class MonitorBulkSerializer(serializers.Serializer):
    """Accept a list of monitor definitions for bulk creation."""
    monitors = MonitorSerializer(many=True)

    def validate_monitors(self, value):
        if not value:
            raise serializers.ValidationError("At least one monitor is required.")
        if len(value) > 50:
            raise serializers.ValidationError("Maximum 50 monitors per bulk request.")
        return value


class MonitorGroupSerializer(TeamScopeSerializerMixin, serializers.ModelSerializer):
    monitor_count = serializers.SerializerMethodField()

    class Meta:
        model = MonitorGroup
        fields = (
            "id", "name", "description", "monitors", "monitor_count",
            "team_id", "team_name",
            "created_at", "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")

    @extend_schema_field(serializers.IntegerField())
    def get_monitor_count(self, obj) -> int:
        return obj.monitors.count()


class MonitorCheckSerializer(serializers.ModelSerializer):
    class Meta:
        model = MonitorCheck
        fields = (
            "id", "monitor", "probe", "checked_at", "status",
            "response_status_code", "response_time_ms",
            "error_message", "triggered_incident",
        )
        read_only_fields = fields


class UptimeSerializer(serializers.Serializer):
    """Output schema for uptime stats."""
    uptime_percent = serializers.FloatField()
    total_checks = serializers.IntegerField()
    failed_checks = serializers.IntegerField()
    successful_checks = serializers.IntegerField()
    period = serializers.DictField()
