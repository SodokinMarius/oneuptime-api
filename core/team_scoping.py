"""
Team-scoped data isolation (Enterprise RBAC §4 — Option A).

Rules:
  - team_id IS NULL  → resource visible to all project members (legacy / shared)
  - team_id set      → visible only to members of that team
  - role with "*"    → sees all resources in the project (admin bypass)
  - superuser        → sees all
"""
from __future__ import annotations

import uuid

from django.db import models
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.rbac.models import Team, TeamMembership
from apps.rbac.permissions import get_user_permissions


def user_sees_all_teams(user, project) -> bool:
    if user.is_superuser:
        return True
    return "*" in get_user_permissions(user, project)


def get_user_team_ids(user, project) -> list[uuid.UUID]:
    return list(
        TeamMembership.objects.filter(user=user, team__project=project)
        .values_list("team_id", flat=True)
    )


def apply_team_scope(qs, user, project):
    """
    Filter a queryset on team-scoped models.

    Includes shared resources (team=NULL) plus resources owned by the user's teams.
    Admins with '*' permission bypass filtering.
    """
    if project is None:
        return qs.none()
    if user_sees_all_teams(user, project):
        return qs

    team_ids = get_user_team_ids(user, project)
    return qs.filter(models.Q(team__isnull=True) | models.Q(team_id__in=team_ids))


def apply_team_param(qs, team_id: str | None):
    """Optional ?team_id= filter on list endpoints."""
    if not team_id:
        return qs
    try:
        tid = uuid.UUID(str(team_id))
    except ValueError as exc:
        raise ValidationError({"team_id": "Invalid UUID."}) from exc
    return qs.filter(team_id=tid)


def resolve_team_for_create(
    request, team=None, explicit_team_id=None, explicit_null=False
):
    """
    Pick the team to assign on resource creation.

    Priority:
      1. explicit team / team_id from request payload (if allowed)
      2. explicit team_id=null → shared resource (admins with '*' only)
      3. first team membership of the user in the project
      4. None (shared resource) — only for users with '*' permission and no teams
    """
    project = getattr(request, "project", None)
    user = request.user
    if project is None:
        raise ValidationError("Project context is required.")

    if explicit_null and team is None:
        if user_sees_all_teams(user, project):
            return None
        raise ValidationError(
            {"team_id": "Only admins can create shared (team-less) resources."}
        )

    target = team
    if target is None and explicit_team_id:
        try:
            target = Team.objects.get(id=explicit_team_id, project=project)
        except Team.DoesNotExist as exc:
            raise ValidationError({"team_id": "Team not found in this project."}) from exc

    if target is not None:
        if user_sees_all_teams(user, project):
            return target
        if not TeamMembership.objects.filter(user=user, team=target).exists():
            raise PermissionDenied("You are not a member of this team.")
        return target

    # No team specified — default to user's first team if any
    membership = (
        TeamMembership.objects.filter(user=user, team__project=project)
        .select_related("team")
        .order_by("created_at")
        .first()
    )
    if membership:
        return membership.team

    if user_sees_all_teams(user, project):
        return None

    raise ValidationError(
        {"team_id": "Team is required. Join a team or specify team_id."}
    )


class TeamScopedViewMixin:
    """
    Mixin for project ViewSets whose models have an optional `team` FK.

    Usage:
        class MonitorViewSet(TeamScopedViewMixin, PermissionMixin, viewsets.ModelViewSet):
            def get_queryset(self):
                qs = Monitor.objects.filter(project=self.request.project)
                return self.scope_queryset_by_team(qs)
    """

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["project"] = getattr(self.request, "project", None)
        return context

    def scope_queryset_by_team(self, queryset):
        project = getattr(self.request, "project", None)
        if project is None:
            return queryset.none()
        qs = apply_team_scope(queryset, self.request.user, project)
        return apply_team_param(qs, self.request.query_params.get("team_id"))

    def resolve_create_team(self, serializer):
        initial = getattr(serializer, "initial_data", {}) or {}
        explicit_null = "team_id" in initial and initial.get("team_id") in (None, "")
        team = serializer.validated_data.pop("team", None)
        return resolve_team_for_create(
            self.request, team=team, explicit_null=explicit_null
        )

    def team_save_kwargs(self, serializer) -> dict:
        return {"team": self.resolve_create_team(serializer)}
