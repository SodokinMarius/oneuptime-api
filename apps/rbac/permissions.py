"""
RBAC permission resolution and DRF permission classes.

Permission check priority:
  1. Superuser → always allowed
  2. Wildcard "*" in role → always allowed
  3. Exact match "resource:action"
  4. Resource wildcard "resource:*"
  5. Action wildcard "*:action"
  6. Deny
"""
from django.db import models
from rest_framework.permissions import BasePermission, IsAuthenticated

from apps.rbac.models import TeamMembership


def get_user_permissions(user, project) -> set:
    """
    Collect all permission strings for a user in a given project,
    merging permissions from all team memberships.
    """
    if user.is_superuser:
        return {"*"}

    memberships = TeamMembership.objects.filter(
        user=user, team__project=project
    ).select_related("role")

    perms = set()
    for m in memberships:
        perms.update(m.role.permissions)
    return perms


def has_permission(user_perms: set, required: str) -> bool:
    """
    Check if a set of permission strings satisfies a required permission.

    Supports wildcards:
      "*"          → grants everything
      "monitor:*"  → grants all monitor actions
      "*:read"     → grants read on all resources
    """
    if "*" in user_perms or required in user_perms:
        return True

    parts = required.split(":", 1)
    if len(parts) != 2:
        return False
    resource, action = parts

    if f"{resource}:*" in user_perms:
        return True
    if f"*:{action}" in user_perms:
        return True
    return False


def check_resource_policy(user, project, resource_type: str, resource_id=None) -> str | None:
    """
    Check ResourcePolicy records for a user's roles on a specific resource.

    Returns:
      'deny'  — if any deny policy matches → block access
      'allow' — if an explicit allow policy matches
      None    — no resource-level policy found, fall back to role check
    """
    from apps.rbac.models import ResourcePolicy, TeamMembership

    role_ids = list(
        TeamMembership.objects.filter(user=user, team__project=project)
        .values_list("role_id", flat=True)
    )
    if not role_ids:
        return None

    qs = ResourcePolicy.objects.filter(
        project=project,
        role_id__in=role_ids,
        resource_type=resource_type,
    ).filter(
        models.Q(resource_id__isnull=True) |
        (models.Q(resource_id=resource_id) if resource_id else models.Q())
    )

    effects = set(qs.values_list("effect", flat=True))
    if ResourcePolicy.EFFECT_DENY in effects:
        return "deny"
    if ResourcePolicy.EFFECT_ALLOW in effects:
        return "allow"
    return None


class RequirePermission(BasePermission):
    """
    DRF permission class that checks a specific resource:action permission.

    Usage:
        class MyView(APIView):
            permission_classes = [RequirePermission("monitor:create")]

    Or via PermissionMixin in ViewSets:
        permission_map = {
            "list":    "monitor:read",
            "create":  "monitor:create",
            "destroy": "monitor:delete",
        }
    """
    def __init__(self, perm: str):
        self.perm = perm

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        project = getattr(request, "project", None)
        if project is None:
            return request.user.is_superuser

        user_perms = get_user_permissions(request.user, project)
        return has_permission(user_perms, self.perm)

    def has_object_permission(self, request, view, obj):
        return self.has_permission(request, view)


class IsSuperAdmin(BasePermission):
    """Grants access only to Django superusers (used for /admin/ endpoints)."""

    def has_permission(self, request, view):
        return bool(
            request.user and request.user.is_authenticated and request.user.is_superuser
        )


class PermissionMixin:
    """
    Mixin for DRF ViewSets that maps actions to required permissions.

    Usage:
        class MonitorViewSet(PermissionMixin, viewsets.ModelViewSet):
            permission_map = {
                "list":     "monitor:read",
                "retrieve": "monitor:read",
                "create":   "monitor:create",
                "update":   "monitor:update",
                "partial_update": "monitor:update",
                "destroy":  "monitor:delete",
                "pause":    "monitor:pause",
            }
    """
    permission_map: dict = {}

    def get_permissions(self):
        perm = self.permission_map.get(self.action)
        if perm:
            return [IsAuthenticated(), RequirePermission(perm)]
        return [IsAuthenticated()]
