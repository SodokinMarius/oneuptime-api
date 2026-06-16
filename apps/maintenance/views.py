"""ViewSet for scheduled maintenance windows."""
from drf_spectacular.utils import extend_schema
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.maintenance.models import MaintenanceStatus, ScheduledMaintenance
from apps.maintenance.serializers import ScheduledMaintenanceSerializer
from apps.rbac.permissions import PermissionMixin
from core.team_scoping import TeamScopedViewMixin


class ScheduledMaintenanceViewSet(TeamScopedViewMixin, PermissionMixin, viewsets.ModelViewSet):
    """CRUD for scheduled maintenance windows."""
    serializer_class = ScheduledMaintenanceSerializer
    permission_map = {
        "list":           "scheduled_maintenance:read",
        "retrieve":       "scheduled_maintenance:read",
        "create":         "scheduled_maintenance:create",
        "update":         "scheduled_maintenance:update",
        "partial_update": "scheduled_maintenance:update",
        "destroy":        "scheduled_maintenance:delete",
        "cancel":         "scheduled_maintenance:update",
    }

    def get_queryset(self):
        project = getattr(self.request, "project", None)
        if project is None:
            return ScheduledMaintenance.objects.none()

        qs = ScheduledMaintenance.objects.filter(project=project)

        if s := self.request.query_params.get("status"):
            qs = qs.filter(status=s)

        return self.scope_queryset_by_team(qs).order_by("-starts_at")

    def perform_create(self, serializer):
        from apps.maintenance.services import emit_maintenance_webhook

        project = self.request.project
        maintenance = serializer.save(
            tenant=project.tenant,
            project=project,
            **self.team_save_kwargs(serializer),
        )
        emit_maintenance_webhook("scheduled_maintenance.created", maintenance)

    @extend_schema(tags=["Maintenance"], summary="Cancel a scheduled maintenance window")
    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        maintenance = self.get_object()
        if maintenance.status == MaintenanceStatus.COMPLETED:
            return Response(
                {"detail": "Cannot cancel a completed maintenance window."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        maintenance.status = MaintenanceStatus.CANCELLED
        maintenance.save(update_fields=["status", "updated_at"])
        return Response(ScheduledMaintenanceSerializer(maintenance).data)
