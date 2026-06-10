"""ViewSets for monitoring resources."""
from datetime import timedelta

from django.utils import timezone
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.monitoring.models import Monitor, MonitorGroup, Probe
from apps.monitoring.serializers import (
    MonitorBulkSerializer,
    MonitorCheckSerializer,
    MonitorGroupSerializer,
    MonitorSerializer,
    ProbeSerializer,
    UptimeSerializer,
)
from apps.monitoring.services.uptime import build_status_timeline, compute_uptime
from apps.rbac.permissions import PermissionMixin
from core.team_scoping import TeamScopedViewMixin, resolve_team_for_create


class MonitorViewSet(TeamScopedViewMixin, PermissionMixin, viewsets.ModelViewSet):
    """
    Full CRUD for monitors plus pause/resume, uptime stats, and status timeline.
    """
    serializer_class = MonitorSerializer
    permission_map = {
        "list":           "monitor:read",
        "retrieve":       "monitor:read",
        "create":         "monitor:create",
        "update":         "monitor:update",
        "partial_update": "monitor:update",
        "destroy":        "monitor:delete",
        "pause":          "monitor:pause",
        "resume":         "monitor:pause",
        "logs":           "monitor:read",
        "uptime":         "monitor:read",
        "status_timeline": "monitor:read",
        "bulk":           "monitor:create",
    }

    def get_queryset(self):
        project = getattr(self.request, "project", None)
        if project is None:
            return Monitor.objects.none()
        qs = Monitor.objects.filter(project=project)

        # Filters
        params = self.request.query_params
        if t := params.get("type"):
            qs = qs.filter(type=t)
        if s := params.get("status"):
            qs = qs.filter(status=s)
        if paused := params.get("paused"):
            qs = qs.filter(is_paused=paused.lower() == "true")
        if search := params.get("search"):
            qs = qs.filter(name__icontains=search) | qs.filter(url__icontains=search)

        return self.scope_queryset_by_team(qs).order_by("name")

    def perform_create(self, serializer):
        project = self.request.project
        now = timezone.now()
        serializer.save(
            tenant=project.tenant,
            project=project,
            next_check_at=now,
            **self.team_save_kwargs(serializer),
        )

    # ------------------------------------------------------------------
    # pause / resume
    # ------------------------------------------------------------------

    @extend_schema(tags=["Monitoring"], summary="Pause a monitor")
    @action(detail=True, methods=["post"])
    def pause(self, request, pk=None):
        monitor = self.get_object()
        if monitor.is_paused:
            return Response({"detail": "Monitor is already paused."})
        monitor.is_paused = True
        monitor.save(update_fields=["is_paused"])
        return Response(MonitorSerializer(monitor).data)

    @extend_schema(tags=["Monitoring"], summary="Resume a paused monitor")
    @action(detail=True, methods=["post"])
    def resume(self, request, pk=None):
        monitor = self.get_object()
        if not monitor.is_paused:
            return Response({"detail": "Monitor is not paused."})
        monitor.is_paused = False
        monitor.next_check_at = timezone.now()
        monitor.save(update_fields=["is_paused", "next_check_at"])
        return Response(MonitorSerializer(monitor).data)

    # ------------------------------------------------------------------
    # logs (recent checks)
    # ------------------------------------------------------------------

    @extend_schema(
        tags=["Monitoring"],
        summary="Get recent probe check logs for a monitor",
        parameters=[
            OpenApiParameter("limit", int, description="Max number of checks (default 100)"),
        ],
    )
    @action(detail=True, methods=["get"])
    def logs(self, request, pk=None):
        monitor = self.get_object()
        limit = min(int(request.query_params.get("limit", 100)), 500)
        checks = monitor.checks.order_by("-checked_at")[:limit]
        return Response(MonitorCheckSerializer(checks, many=True).data)

    # ------------------------------------------------------------------
    # uptime percentage
    # ------------------------------------------------------------------

    @extend_schema(
        tags=["Monitoring"],
        summary="Get uptime percentage for a monitor",
        parameters=[
            OpenApiParameter("days", int, description="Number of days (default 30, max 90)"),
            OpenApiParameter("from", str, description="ISO datetime start (overrides days)"),
            OpenApiParameter("to", str, description="ISO datetime end (overrides days)"),
        ],
    )
    @action(detail=True, methods=["get"])
    def uptime(self, request, pk=None):
        monitor = self.get_object()
        params = request.query_params

        since, until = _parse_range(params)
        result = compute_uptime(monitor, since=since, until=until)
        if result is None:
            return Response(
                {"detail": "No check data available for this period."},
                status=status.HTTP_200_OK,
            )
        return Response(result)

    # ------------------------------------------------------------------
    # status timeline
    # ------------------------------------------------------------------

    @extend_schema(
        tags=["Monitoring"],
        summary="Get operational/degraded/offline timeline for a monitor",
        parameters=[
            OpenApiParameter("days", int, description="Number of days (default 30, max 90)"),
        ],
    )
    @action(detail=True, methods=["get"], url_path="status-timeline")
    def status_timeline(self, request, pk=None):
        monitor = self.get_object()
        since, until = _parse_range(request.query_params)
        timeline = build_status_timeline(monitor, since=since, until=until)
        return Response({"timeline": timeline, "monitor_id": str(monitor.id)})

    # ------------------------------------------------------------------
    # bulk create
    # ------------------------------------------------------------------

    @extend_schema(
        tags=["Monitoring"],
        summary="Bulk create monitors",
        request=MonitorBulkSerializer,
    )
    @action(detail=False, methods=["post"])
    def bulk(self, request):
        serializer = MonitorBulkSerializer(
            data=request.data,
            context={"request": request, "project": request.project},
        )
        serializer.is_valid(raise_exception=True)

        project = request.project
        now = timezone.now()
        created = []
        for monitor_data in serializer.validated_data["monitors"]:
            data = dict(monitor_data)
            team = resolve_team_for_create(request, team=data.pop("team", None))
            m = Monitor.objects.create(
                tenant=project.tenant,
                project=project,
                next_check_at=now,
                team=team,
                **data,
            )
            created.append(m)

        return Response(
            self.get_serializer(created, many=True).data,
            status=status.HTTP_201_CREATED,
        )


class MonitorGroupViewSet(TeamScopedViewMixin, PermissionMixin, viewsets.ModelViewSet):
    """CRUD for monitor groups."""
    serializer_class = MonitorGroupSerializer
    permission_map = {
        "list":           "monitor_group:read",
        "retrieve":       "monitor_group:read",
        "create":         "monitor_group:create",
        "update":         "monitor_group:update",
        "partial_update": "monitor_group:update",
        "destroy":        "monitor_group:delete",
    }

    def get_queryset(self):
        project = getattr(self.request, "project", None)
        if project is None:
            return MonitorGroup.objects.none()
        qs = MonitorGroup.objects.filter(project=project).prefetch_related("monitors")
        return self.scope_queryset_by_team(qs)

    def perform_create(self, serializer):
        project = self.request.project
        serializer.save(
            tenant=project.tenant,
            project=project,
            **self.team_save_kwargs(serializer),
        )


class ProbeViewSet(PermissionMixin, viewsets.ReadOnlyModelViewSet):
    """List probes and check health."""
    serializer_class = ProbeSerializer
    permission_map = {
        "list":     "probe:read",
        "retrieve": "probe:read",
        "health":   "probe:read",
    }

    def get_queryset(self):
        project = getattr(self.request, "project", None)
        if project is None:
            return Probe.objects.none()
        return Probe.objects.filter(project=project, is_active=True)

    @extend_schema(tags=["Monitoring"], summary="Get probe health metrics")
    @action(detail=True, methods=["get"])
    def health(self, request, pk=None):
        probe = self.get_object()
        from datetime import timedelta
        last_hour = timezone.now() - timedelta(hours=1)
        from apps.monitoring.models import MonitorCheck
        checks = MonitorCheck.objects.filter(probe=probe, checked_at__gte=last_hour)
        total = checks.count()
        failed = checks.exclude(status="success").count()
        return Response({
            "probe": ProbeSerializer(probe).data,
            "last_hour": {
                "total_checks": total,
                "failed_checks": failed,
                "success_rate": round(((total - failed) / total * 100), 2) if total else None,
            },
        })


# ------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------

def _parse_range(params):
    """Parse since/until from query params. Falls back to last N days."""
    from django.utils.dateparse import parse_datetime
    since = None
    until = None

    if raw_from := params.get("from"):
        since = parse_datetime(raw_from)
    if raw_to := params.get("to"):
        until = parse_datetime(raw_to)

    if since is None:
        days = min(int(params.get("days", 30)), 90)
        since = timezone.now() - timedelta(days=days)
    if until is None:
        until = timezone.now()

    return since, until
