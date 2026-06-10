"""
RBAC permission resolution and DRF permission classes.

Permission check priority:
  1. Superuser → always allowed
  2. ResourcePolicy deny → block (users only, not API keys)
  3. ResourcePolicy allow → permit (users only)
  4. API key permissions (when authenticated via ok_... token)
  5. Role permissions (wildcard-aware)
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


def get_request_permissions(request, project) -> set:
    """
    Effective permission set for the current request.

    API keys use their own permission list; JWT users use merged team roles.
    """
    api_key = getattr(request, "api_key", None)
    if api_key:
        return set(api_key.permissions or [])

    if not request.user or not request.user.is_authenticated:
        return set()

    if project is None:
        return {"*"} if request.user.is_superuser else set()

    return get_user_permissions(request.user, project)


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
      None    — no resource-level policy found, fall back to role/API-key check

    When resource_id is None (list/create actions), only type-wide policies
    (resource_id IS NULL) are considered.
    """
    from apps.rbac.models import ResourcePolicy

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
    )
    if resource_id is not None:
        qs = qs.filter(
            models.Q(resource_id__isnull=True) | models.Q(resource_id=resource_id)
        )
    else:
        qs = qs.filter(resource_id__isnull=True)

    effects = set(qs.values_list("effect", flat=True))
    if ResourcePolicy.EFFECT_DENY in effects:
        return "deny"
    if ResourcePolicy.EFFECT_ALLOW in effects:
        return "allow"
    return None


class RequirePermission(BasePermission):
    """
    DRF permission class that checks a specific resource:action permission.

    Integrates:
      - Role-based permissions (team memberships)
      - API key scoped permissions (request.api_key)
      - ResourcePolicy allow/deny overrides (JWT users only)

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
        parts = perm.split(":", 1)
        self._resource_type = parts[0] if len(parts) == 2 else ""

    def _evaluate(self, request, obj=None) -> bool:
        user = request.user
        if not user or not user.is_authenticated:
            return False

        if user.is_superuser:
            return True

        project = getattr(request, "project", None)
        api_key = getattr(request, "api_key", None)

        resource_id = getattr(obj, "id", None) if obj is not None else None

        # Resource policies are evaluated for human users (role-linked), not API keys
        if project and not api_key and self._resource_type:
            policy_result = check_resource_policy(
                user, project, self._resource_type, resource_id
            )
            if policy_result == "deny":
                return False
            if policy_result == "allow":
                return True

        if project is None:
            return False

        user_perms = get_request_permissions(request, project)
        return has_permission(user_perms, self.perm)

    def has_permission(self, request, view):
        return self._evaluate(request, obj=None)

    def has_object_permission(self, request, view, obj):
        return self._evaluate(request, obj=obj)


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
