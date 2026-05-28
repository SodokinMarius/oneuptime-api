"""ViewSets for Role, Team, ApiKey endpoints."""
from django.shortcuts import get_object_or_404
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.rbac.constants import ALL_PERMISSIONS
from apps.rbac.models import ApiKey, ResourcePolicy, Role, Team, TeamMembership
from apps.rbac.permissions import IsSuperAdmin, PermissionMixin
from apps.rbac.serializers import (
    AddTeamMemberSerializer,
    ApiKeyCreateSerializer,
    ApiKeySerializer,
    ResourcePolicySerializer,
    RoleSerializer,
    TeamMemberSerializer,
    TeamSerializer,
)


class RoleViewSet(PermissionMixin, viewsets.ModelViewSet):
    """
    CRUD for project roles.
    System roles (admin, member, viewer) are read-only.
    """
    serializer_class = RoleSerializer
    permission_map = {
        "list":           "role:read",
        "retrieve":       "role:read",
        "create":         "role:create",
        "update":         "role:update",
        "partial_update": "role:update",
        "destroy":        "role:delete",
    }

    def get_queryset(self):
        project = getattr(self.request, "project", None)
        if project is None:
            return Role.objects.none()
        return Role.objects.filter(project=project).order_by("name")

    def perform_create(self, serializer):
        project = self.request.project
        serializer.save(tenant=project.tenant, project=project, is_system=False)

    def destroy(self, request, *args, **kwargs):
        role = self.get_object()
        if role.is_system:
            return Response(
                {"type": "conflict", "title": "Conflict", "status": 409,
                 "detail": "System roles cannot be deleted."},
                status=status.HTTP_409_CONFLICT,
            )
        role.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @extend_schema(tags=["RBAC"], summary="List all available permission strings")
    @action(detail=False, methods=["get"], url_path="permissions",
            permission_map={})
    def permissions_list(self, request):
        return Response({"permissions": ALL_PERMISSIONS})


class TeamViewSet(PermissionMixin, viewsets.ModelViewSet):
    """CRUD for project teams."""
    serializer_class = TeamSerializer
    permission_map = {
        "list":           "team:read",
        "retrieve":       "team:read",
        "create":         "team:create",
        "update":         "team:update",
        "partial_update": "team:update",
        "destroy":        "team:delete",
        "members":        "team:read",
        "add_member":     "team:manage_members",
        "remove_member":  "team:manage_members",
    }

    def get_queryset(self):
        project = getattr(self.request, "project", None)
        if project is None:
            return Team.objects.none()
        return Team.objects.filter(project=project).prefetch_related("memberships")

    def perform_create(self, serializer):
        project = self.request.project
        serializer.save(tenant=project.tenant, project=project)

    @extend_schema(tags=["RBAC"], summary="List team members")
    @action(detail=True, methods=["get"], url_path="members")
    def members(self, request, pk=None):
        team = self.get_object()
        memberships = team.memberships.select_related("user", "role").all()
        return Response(TeamMemberSerializer(memberships, many=True).data)

    @extend_schema(tags=["RBAC"], summary="Add a member to the team",
                   request=AddTeamMemberSerializer)
    @action(detail=True, methods=["post"], url_path="members")
    def add_member(self, request, pk=None):
        team = self.get_object()
        serializer = AddTeamMemberSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        from django.contrib.auth import get_user_model
        User = get_user_model()
        user = get_object_or_404(User, id=serializer.validated_data["user_id"])
        role = get_object_or_404(Role, id=serializer.validated_data["role_id"],
                                 project=team.project)

        membership, created = TeamMembership.objects.get_or_create(
            team=team, user=user,
            defaults={"role": role, "granted_by": request.user},
        )
        if not created:
            return Response(
                {"type": "conflict", "title": "Conflict", "status": 409,
                 "detail": "User is already a member of this team."},
                status=status.HTTP_409_CONFLICT,
            )
        return Response(TeamMemberSerializer(membership).data, status=status.HTTP_201_CREATED)

    @extend_schema(tags=["RBAC"], summary="Remove a member from the team")
    @action(detail=True, methods=["delete"], url_path="members/(?P<user_id>[^/.]+)")
    def remove_member(self, request, pk=None, user_id=None):
        team = self.get_object()
        membership = get_object_or_404(TeamMembership, team=team, user_id=user_id)
        membership.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ApiKeyViewSet(PermissionMixin, viewsets.GenericViewSet):
    """Create, list and revoke API keys for the current project."""
    serializer_class = ApiKeySerializer
    permission_map = {
        "list":    "api_key:read",
        "create":  "api_key:create",
        "destroy": "api_key:revoke",
    }

    def get_queryset(self):
        project = getattr(self.request, "project", None)
        if project is None:
            return ApiKey.objects.none()
        return ApiKey.objects.filter(project=project, revoked_at__isnull=True)

    @extend_schema(tags=["RBAC"], summary="List API keys for the current project")
    def list(self, request):
        qs = self.get_queryset()
        return Response(ApiKeySerializer(qs, many=True).data)

    @extend_schema(
        tags=["RBAC"],
        summary="Create an API key — the raw key is returned once only",
        request=ApiKeyCreateSerializer,
    )
    def create(self, request):
        serializer = ApiKeyCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        project = request.project
        instance, raw_key = ApiKey.create_key(
            tenant=project.tenant,
            project=project,
            name=serializer.validated_data["name"],
            permissions=serializer.validated_data.get("permissions", []),
            created_by=request.user,
            expires_at=serializer.validated_data.get("expires_at"),
        )
        data = ApiKeySerializer(instance).data
        data["key"] = raw_key  # shown once — never stored
        return Response(data, status=status.HTTP_201_CREATED)

    @extend_schema(tags=["RBAC"], summary="Revoke an API key")
    def destroy(self, request, pk=None):
        api_key = get_object_or_404(self.get_queryset(), pk=pk)
        api_key.revoked_at = timezone.now()
        api_key.save(update_fields=["revoked_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)


class ResourcePolicyViewSet(PermissionMixin, viewsets.ModelViewSet):
    """
    Fine-grained allow/deny policies on specific resources.

    A deny policy on a specific resource_id overrides any role-level allow.
    resource_id=null means the policy applies to all resources of that type.
    """
    serializer_class = ResourcePolicySerializer
    permission_map = {
        "list":           "rbac:read",
        "retrieve":       "rbac:read",
        "create":         "rbac:manage",
        "update":         "rbac:manage",
        "partial_update": "rbac:manage",
        "destroy":        "rbac:manage",
    }

    def get_queryset(self):
        project = getattr(self.request, "project", None)
        if project is None:
            return ResourcePolicy.objects.none()
        qs = ResourcePolicy.objects.filter(project=project).select_related("role")
        if rt := self.request.query_params.get("resource_type"):
            qs = qs.filter(resource_type=rt)
        if rid := self.request.query_params.get("resource_id"):
            qs = qs.filter(resource_id=rid)
        return qs.order_by("resource_type", "-created_at")

    def perform_create(self, serializer):
        project = self.request.project
        serializer.save(tenant=project.tenant, project=project)
