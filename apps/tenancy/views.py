"""ViewSets for tenancy resources."""
from drf_spectacular.utils import extend_schema
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.rbac.permissions import IsSuperAdmin, PermissionMixin
from apps.tenancy.models import Project, Tenant
from apps.tenancy.serializers import (
    ProjectSerializer,
    TenantDetailSerializer,
    TenantSerializer,
)


class TenantViewSet(viewsets.ModelViewSet):
    """
    Super-admin CRUD for tenants.

    Only Django superusers can access these endpoints.
    Regular users manage their own tenant settings via /projects/.
    """
    permission_classes = [IsSuperAdmin]

    def get_serializer_class(self):
        if self.action == "retrieve":
            return TenantDetailSerializer
        return TenantSerializer

    def get_queryset(self):
        qs = Tenant.objects.all()
        if status_filter := self.request.query_params.get("status"):
            qs = qs.filter(status=status_filter)
        if search := self.request.query_params.get("search"):
            qs = qs.filter(name__icontains=search) | qs.filter(slug__icontains=search)
        return qs.order_by("-created_at")

    @extend_schema(tags=["Tenants"], summary="Suspend a tenant")
    @action(detail=True, methods=["post"])
    def suspend(self, request, pk=None):
        tenant = self.get_object()
        if tenant.status == "suspended":
            return Response({"detail": "Tenant is already suspended."})
        tenant.status = "suspended"
        tenant.save(update_fields=["status", "updated_at"])
        return Response({"detail": "Tenant suspended."})

    @extend_schema(tags=["Tenants"], summary="Reactivate a suspended tenant")
    @action(detail=True, methods=["post"])
    def activate(self, request, pk=None):
        tenant = self.get_object()
        if tenant.status == "active":
            return Response({"detail": "Tenant is already active."})
        tenant.status = "active"
        tenant.save(update_fields=["status", "updated_at"])
        return Response({"detail": "Tenant activated."})


class ProjectViewSet(PermissionMixin, viewsets.ModelViewSet):
    """
    CRUD for projects within the current tenant.
    The tenant is resolved by TenantMiddleware from the X-Tenant-Id header or subdomain.
    """
    serializer_class = ProjectSerializer
    permission_map = {
        "list":           "project:read",
        "retrieve":       "project:read",
        "create":         "project:create",
        "update":         "project:update",
        "partial_update": "project:update",
        "destroy":        "project:delete",
    }

    def get_queryset(self):
        tenant = getattr(self.request, "tenant", None)
        if tenant is None:
            return Project.objects.none()
        qs = Project.objects.filter(tenant=tenant)
        if active := self.request.query_params.get("active"):
            qs = qs.filter(is_active=active.lower() == "true")
        return qs.order_by("name")

    def perform_create(self, serializer):
        from apps.rbac.models import Team, TeamMembership
        from apps.rbac.services import bootstrap_project

        project = serializer.save(tenant=self.request.tenant)
        bootstrapped = bootstrap_project(project, self.request.tenant)

        user = getattr(self.request, "user", None)
        if user and user.is_authenticated:
            admin_role = bootstrapped["roles"].get("admin")
            if admin_role:
                admin_team, _ = Team.objects.get_or_create(
                    project=project,
                    name="Administrators",
                    defaults={
                        "tenant": self.request.tenant,
                        "description": "Project owners and administrators",
                    },
                )
                TeamMembership.objects.get_or_create(
                    team=admin_team,
                    user=user,
                    defaults={"role": admin_role, "granted_by": user},
                )

    def destroy(self, request, *args, **kwargs):
        project = self.get_object()
        # Soft-delete: mark as inactive rather than hard delete
        project.is_active = False
        project.save(update_fields=["is_active", "updated_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)
