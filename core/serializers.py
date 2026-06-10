"""Shared DRF serializer utilities."""
from rest_framework import serializers

from apps.rbac.models import Team


class TeamScopeSerializerMixin(serializers.Serializer):
    """
    Adds optional team_id on write and team_id/team_name on read.

    Pass project in serializer context (TeamScopedViewMixin does this).
    """
    team_id = serializers.PrimaryKeyRelatedField(
        source="team",
        queryset=Team.objects.all(),
        required=False,
        allow_null=True,
    )
    team_name = serializers.SerializerMethodField()

    def get_team_name(self, obj) -> str | None:
        return obj.team.name if getattr(obj, "team_id", None) else None

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        project = self.context.get("project")
        if project is not None and "team_id" in self.fields:
            self.fields["team_id"].queryset = Team.objects.filter(project=project)
