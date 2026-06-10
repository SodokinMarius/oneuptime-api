"""Serializers for webhooks resources."""
import secrets

from rest_framework import serializers

from apps.webhooks.models import Webhook, WebhookDelivery
from core.serializers import TeamScopeSerializerMixin


class WebhookSerializer(TeamScopeSerializerMixin, serializers.ModelSerializer):
    class Meta:
        model = Webhook
        fields = (
            "id", "name", "url", "secret", "event_types",
            "is_active", "headers", "timeout_seconds", "max_retries",
            "team_id", "team_name",
            "created_at", "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")
        extra_kwargs = {
            "secret": {"write_only": True, "required": False},
        }

    def validate_event_types(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError("event_types must be a list.")
        return value

    def create(self, validated_data):
        if not validated_data.get("secret"):
            validated_data["secret"] = secrets.token_hex(32)
        return super().create(validated_data)


class WebhookDeliverySerializer(serializers.ModelSerializer):
    class Meta:
        model = WebhookDelivery
        fields = (
            "id", "event_id", "event_type", "payload",
            "response_status", "response_body", "attempt_count",
            "status", "next_retry_at", "delivered_at", "duration_ms",
            "created_at", "updated_at",
        )
        read_only_fields = fields
