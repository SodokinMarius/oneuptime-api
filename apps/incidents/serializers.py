"""Serializers for incidents resources."""
from rest_framework import serializers

from apps.incidents.models import (
    Incident,
    IncidentNote,
    IncidentPostmortem,
    IncidentSeverity,
    IncidentState,
)


class IncidentStateSerializer(serializers.ModelSerializer):
    class Meta:
        model = IncidentState
        fields = ("id", "name", "color", "order", "is_resolved_state", "is_system",
                  "created_at", "updated_at")
        read_only_fields = ("id", "is_system", "created_at", "updated_at")

    def validate(self, attrs):
        if self.instance and self.instance.is_system:
            raise serializers.ValidationError(
                "System states cannot be modified. Create a custom state instead."
            )
        return attrs


class IncidentSeveritySerializer(serializers.ModelSerializer):
    class Meta:
        model = IncidentSeverity
        fields = ("id", "name", "color", "order", "is_system", "created_at", "updated_at")
        read_only_fields = ("id", "is_system", "created_at", "updated_at")

    def validate(self, attrs):
        if self.instance and self.instance.is_system:
            raise serializers.ValidationError(
                "System severities cannot be modified. Create a custom severity instead."
            )
        return attrs


class IncidentNoteSerializer(serializers.ModelSerializer):
    author_email = serializers.EmailField(source="author.email", read_only=True)

    class Meta:
        model = IncidentNote
        fields = ("id", "content", "is_public", "author_email", "created_at", "updated_at")
        read_only_fields = ("id", "author_email", "created_at", "updated_at")


class IncidentPostmortemSerializer(serializers.ModelSerializer):
    class Meta:
        model = IncidentPostmortem
        fields = ("id", "summary", "impact", "root_cause", "timeline",
                  "action_items", "published_at", "created_at", "updated_at")
        read_only_fields = ("id", "created_at", "updated_at")


class IncidentSerializer(serializers.ModelSerializer):
    state_name = serializers.CharField(source="state.name", read_only=True)
    severity_name = serializers.CharField(source="severity.name", read_only=True)
    is_resolved = serializers.BooleanField(read_only=True)

    class Meta:
        model = Incident
        fields = (
            "id", "title", "description",
            "severity", "severity_name",
            "state", "state_name",
            "is_resolved",
            "monitor",
            "assigned_to",
            "is_visible_on_status_page",
            "triggered_at",
            "acknowledged_at", "acknowledged_by",
            "resolved_at", "resolved_by",
            "created_at", "updated_at",
        )
        read_only_fields = (
            "id", "state_name", "severity_name", "is_resolved",
            "triggered_at",
            "acknowledged_at", "acknowledged_by",
            "resolved_at", "resolved_by",
            "created_at", "updated_at",
        )

    def validate(self, attrs):
        # severity and state must belong to the same project
        request = self.context.get("request")
        project = getattr(request, "project", None) if request else None
        if project:
            severity = attrs.get("severity", getattr(self.instance, "severity", None))
            state = attrs.get("state", getattr(self.instance, "state", None))
            if severity and severity.project_id != project.id:
                raise serializers.ValidationError(
                    {"severity": "Severity does not belong to this project."}
                )
            if state and state.project_id != project.id:
                raise serializers.ValidationError(
                    {"state": "State does not belong to this project."}
                )
        return attrs


class AssignIncidentSerializer(serializers.Serializer):
    user_id = serializers.UUIDField()


class AddNoteSerializer(serializers.Serializer):
    content = serializers.CharField(min_length=1)
    is_public = serializers.BooleanField(default=False)
