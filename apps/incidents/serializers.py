"""Serializers for incidents resources."""
from rest_framework import serializers

from core.serializers import TeamScopeSerializerMixin

from apps.incidents.models import (
    EscalationPolicy,
    EscalationStep,
    Incident,
    IncidentEscalationState,
    IncidentNote,
    IncidentPostmortem,
    IncidentSeverity,
    IncidentState,
    IncidentWorkflowRule,
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
    author_email = serializers.SerializerMethodField()

    class Meta:
        model = IncidentNote
        fields = ("id", "content", "is_public", "author_email", "created_at", "updated_at")
        read_only_fields = ("id", "author_email", "created_at", "updated_at")

    def get_author_email(self, obj) -> str | None:
        if obj.author_id and obj.author:
            return obj.author.email
        return None


class IncidentPostmortemSerializer(serializers.ModelSerializer):
    published = serializers.SerializerMethodField()

    class Meta:
        model = IncidentPostmortem
        fields = (
            "id", "summary", "impact", "root_cause", "timeline",
            "action_items", "published_at", "published",
            "created_at", "updated_at",
        )
        read_only_fields = ("id", "published", "created_at", "updated_at")

    def get_published(self, obj) -> bool:
        return obj.published_at is not None

    def validate_action_items(self, value):
        if isinstance(value, str):
            lines = [line.strip() for line in value.splitlines() if line.strip()]
            return lines or []
        if value is None:
            return []
        return value


class IncidentEscalationStateSerializer(serializers.ModelSerializer):
    policy_name = serializers.CharField(source="policy.name", read_only=True)

    class Meta:
        model = IncidentEscalationState
        fields = (
            "policy",
            "policy_name",
            "current_step_order",
            "last_escalated_at",
            "completed",
        )


class IncidentSerializer(TeamScopeSerializerMixin, serializers.ModelSerializer):
    state_name = serializers.CharField(source="state.name", read_only=True)
    severity_name = serializers.CharField(source="severity.name", read_only=True)
    is_resolved = serializers.BooleanField(read_only=True)
    escalation_state = serializers.SerializerMethodField()

    class Meta:
        model = Incident
        fields = (
            "id", "title", "description",
            "severity", "severity_name",
            "state", "state_name",
            "is_resolved",
            "monitor",
            "team_id", "team_name",
            "assigned_to",
            "is_visible_on_status_page",
            "escalation_state",
            "triggered_at",
            "acknowledged_at", "acknowledged_by",
            "resolved_at", "resolved_by",
            "created_at", "updated_at",
        )
        read_only_fields = (
            "id", "state_name", "severity_name", "is_resolved", "escalation_state",
            "triggered_at",
            "acknowledged_at", "acknowledged_by",
            "resolved_at", "resolved_by",
            "created_at", "updated_at",
        )

    def get_escalation_state(self, obj):
        try:
            state = obj.escalation_state
        except IncidentEscalationState.DoesNotExist:
            return None
        return IncidentEscalationStateSerializer(state).data

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
    is_public = serializers.BooleanField(default=False, required=False)
    is_internal = serializers.BooleanField(default=False, required=False, write_only=True)

    def validate(self, attrs):
        if attrs.pop("is_internal", False):
            attrs["is_public"] = False
        elif "is_public" not in attrs:
            attrs["is_public"] = False
        return attrs


class EscalationStepSerializer(serializers.ModelSerializer):
    class Meta:
        model = EscalationStep
        fields = (
            "id", "order", "delay_minutes", "action",
            "webhook", "user", "target_severity", "created_at",
        )
        read_only_fields = ("id", "created_at")


class EscalationPolicySerializer(TeamScopeSerializerMixin, serializers.ModelSerializer):
    steps = EscalationStepSerializer(many=True, read_only=True)
    step_count = serializers.SerializerMethodField()

    class Meta:
        model = EscalationPolicy
        fields = (
            "id", "name", "description", "is_default", "is_active",
            "severity_names", "team_id", "team_name",
            "steps", "step_count",
            "created_at", "updated_at",
        )
        read_only_fields = ("id", "steps", "step_count", "created_at", "updated_at")

    def get_step_count(self, obj) -> int:
        return obj.steps.count()


class EscalationStepWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = EscalationStep
        fields = ("order", "delay_minutes", "action", "webhook", "user", "target_severity")


class IncidentWorkflowRuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = IncidentWorkflowRule
        fields = (
            "id", "name", "trigger", "conditions", "actions",
            "is_active", "created_at", "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")

    def validate_actions(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError("actions must be a list.")
        allowed = {"webhook", "assign", "notify_user", "increase_severity"}
        for action in value:
            if action.get("type") not in allowed:
                raise serializers.ValidationError(
                    f"Unknown action type '{action.get('type')}'. Allowed: {sorted(allowed)}"
                )
        return value
