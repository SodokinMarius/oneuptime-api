"""ViewSets for audit resources."""
import csv
import io
import json

from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from django.http import StreamingHttpResponse

from apps.audit.models import AuditLog, RetentionPolicy
from apps.audit.serializers import AuditLogSerializer, RetentionPolicySerializer
from apps.audit.services import AuditService
from apps.rbac.permissions import PermissionMixin


class AuditLogViewSet(
    PermissionMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    """
    Read-only audit log — records are immutable and append-only.

    Supports filtering by action, resource_type, and actor_type.
    The `verify` action checks the hash-chain integrity for the current tenant.
    """
    serializer_class = AuditLogSerializer
    permission_map = {
        "list":     "audit_log:read",
        "retrieve": "audit_log:read",
        "verify":   "audit_log:verify",
        "export":   "audit_log:export",
    }

    def get_queryset(self):
        tenant = getattr(self.request, "tenant", None)
        if tenant is None:
            return AuditLog.objects.none()

        qs = AuditLog.objects.filter(tenant=tenant).select_related("project")

        # Scope to the current project if X-Project-Id was provided
        project = getattr(self.request, "project", None)
        if project and self.request.query_params.get("project_scoped", "true") == "true":
            qs = qs.filter(project=project)

        params = self.request.query_params
        if action_filter := params.get("action"):
            qs = qs.filter(action__icontains=action_filter)
        if resource_type := params.get("resource_type"):
            qs = qs.filter(resource_type=resource_type)
        if actor_type := params.get("actor_type"):
            qs = qs.filter(actor_type=actor_type)
        if since := params.get("since"):
            qs = qs.filter(created_at__gte=since)
        if until := params.get("until"):
            qs = qs.filter(created_at__lte=until)

        return qs.order_by("-created_at")

    @extend_schema(
        tags=["Audit"],
        summary="Verify the hash-chain integrity of the audit log",
    )
    @action(detail=False, methods=["get"])
    def verify(self, request):
        tenant = getattr(request, "tenant", None)
        if tenant is None:
            return Response({"detail": "No tenant context."}, status=400)
        result = AuditService.verify_chain(tenant)
        return Response(result)

    @extend_schema(
        tags=["Audit"],
        summary="Export audit log for SIEM (CSV or JSONL)",
        parameters=[
            OpenApiParameter("format", str, description="csv or jsonl (default: jsonl)"),
            OpenApiParameter("since", str, description="ISO 8601 start date"),
            OpenApiParameter("until", str, description="ISO 8601 end date"),
        ],
    )
    @action(detail=False, methods=["get"])
    def export(self, request):
        """
        Stream the full audit log as CSV or JSONL for SIEM ingestion.
        Applies the same filters as the list endpoint (since, until, action, etc.).
        """
        fmt = request.query_params.get("format", "jsonl").lower()
        if fmt not in ("csv", "jsonl"):
            return Response(
                {"detail": "format must be 'csv' or 'jsonl'."},
                status=400,
            )

        qs = self.get_queryset().order_by("id")

        if fmt == "jsonl":
            return self._stream_jsonl(qs)
        return self._stream_csv(qs)

    # ------------------------------------------------------------------
    # Streaming helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _iter_jsonl(qs):
        for log in qs.iterator(chunk_size=500):
            yield json.dumps({
                "id": log.id,
                "actor_id": str(log.actor_id),
                "actor_type": log.actor_type,
                "action": log.action,
                "resource_type": log.resource_type,
                "resource_id": str(log.resource_id) if log.resource_id else None,
                "old_value": log.old_value,
                "new_value": log.new_value,
                "ip_address": log.ip_address,
                "user_agent": log.user_agent,
                "record_hash": log.record_hash,
                "prev_hash": log.prev_hash,
                "created_at": log.created_at.isoformat(),
            }, default=str) + "\n"

    def _stream_jsonl(self, qs):
        response = StreamingHttpResponse(
            self._iter_jsonl(qs),
            content_type="application/x-ndjson",
        )
        response["Content-Disposition"] = 'attachment; filename="audit_log.jsonl"'
        return response

    @staticmethod
    def _iter_csv(qs):
        FIELDS = [
            "id", "actor_id", "actor_type", "action",
            "resource_type", "resource_id", "ip_address",
            "user_agent", "record_hash", "created_at",
        ]
        buf = io.StringIO()
        writer = csv.DictWriter(buf, fieldnames=FIELDS)
        writer.writeheader()
        yield buf.getvalue()
        buf.truncate(0)
        buf.seek(0)

        for log in qs.iterator(chunk_size=500):
            writer.writerow({
                "id": log.id,
                "actor_id": str(log.actor_id),
                "actor_type": log.actor_type,
                "action": log.action,
                "resource_type": log.resource_type,
                "resource_id": str(log.resource_id) if log.resource_id else "",
                "ip_address": log.ip_address or "",
                "user_agent": log.user_agent,
                "record_hash": log.record_hash,
                "created_at": log.created_at.isoformat(),
            })
            yield buf.getvalue()
            buf.truncate(0)
            buf.seek(0)

    def _stream_csv(self, qs):
        response = StreamingHttpResponse(
            self._iter_csv(qs),
            content_type="text/csv",
        )
        response["Content-Disposition"] = 'attachment; filename="audit_log.csv"'
        return response


class RetentionPolicyViewSet(PermissionMixin, viewsets.ModelViewSet):
    """
    CRUD for per-project data retention policies.

    Each project can define one policy per data_type (monitor_checks,
    audit_logs, webhook_deliveries, incidents_resolved). The `purge_expired`
    scheduler job enforces these policies daily at 03:00.
    """
    serializer_class = RetentionPolicySerializer
    permission_map = {
        "list":           "retention_policy:read",
        "retrieve":       "retention_policy:read",
        "create":         "retention_policy:update",
        "update":         "retention_policy:update",
        "partial_update": "retention_policy:update",
        "destroy":        "retention_policy:update",
    }

    def get_queryset(self):
        project = getattr(self.request, "project", None)
        if project is None:
            return RetentionPolicy.objects.none()
        return RetentionPolicy.objects.filter(project=project).order_by("data_type")

    def perform_create(self, serializer):
        project = self.request.project
        serializer.save(tenant=project.tenant, project=project)
