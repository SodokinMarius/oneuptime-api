"""
Admin API — super-admin endpoints (§20 of the CDC).

All views require `is_superuser=True`. They operate cross-tenant.
"""
from django.db import connection
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

from apps.admin_api.serializers import (
    AdminTenantSerializer,
    AdminTenantUpdateSerializer,
    AdminTenantUsageSerializer,
)
from apps.audit.serializers import AuditLogSerializer
from apps.rbac.permissions import IsSuperAdmin
from apps.tenancy.models import Tenant


class AdminTenantViewSet(viewsets.ModelViewSet):
    """
    Super-admin CRUD for tenants plus suspend / activate / impersonate / usage.

    All endpoints are restricted to Django superusers.
    """
    permission_classes = [IsSuperAdmin]

    def get_serializer_class(self):
        if self.action in ("update", "partial_update"):
            return AdminTenantUpdateSerializer
        return AdminTenantSerializer

    def get_queryset(self):
        qs = Tenant.objects.all()
        params = self.request.query_params
        if status_filter := params.get("status"):
            qs = qs.filter(status=status_filter)
        if plan := params.get("plan"):
            qs = qs.filter(plan=plan)
        if search := params.get("search"):
            qs = qs.filter(name__icontains=search) | qs.filter(slug__icontains=search)
        return qs.order_by("-created_at")

    # ------------------------------------------------------------------
    # Lifecycle actions
    # ------------------------------------------------------------------

    @extend_schema(tags=["Admin"], summary="Suspend a tenant")
    @action(detail=True, methods=["post"])
    def suspend(self, request, pk=None):
        tenant = self.get_object()
        tenant.status = "suspended"
        tenant.save(update_fields=["status", "updated_at"])
        return Response({"detail": f"Tenant '{tenant.name}' suspended."})

    @extend_schema(tags=["Admin"], summary="Reactivate a suspended tenant")
    @action(detail=True, methods=["post"])
    def activate(self, request, pk=None):
        tenant = self.get_object()
        tenant.status = "active"
        tenant.save(update_fields=["status", "updated_at"])
        return Response({"detail": f"Tenant '{tenant.name}' activated."})

    @extend_schema(tags=["Admin"], summary="Hard-delete a tenant and all its data")
    def destroy(self, request, *args, **kwargs):
        tenant = self.get_object()
        name = tenant.name
        tenant.delete()  # CASCADE removes all child rows
        return Response(
            {"detail": f"Tenant '{name}' and all associated data deleted."},
            status=status.HTTP_200_OK,
        )

    # ------------------------------------------------------------------
    # Impersonation
    # ------------------------------------------------------------------

    @extend_schema(
        tags=["Admin"],
        summary="Get impersonation JWT token for a tenant user",
        request={"application/json": {
            "type": "object",
            "required": ["user_id"],
            "properties": {"user_id": {"type": "string", "format": "uuid"}},
        }},
    )
    @action(detail=True, methods=["post"])
    def impersonate(self, request, pk=None):
        """
        Generate a short-lived JWT on behalf of a user in this tenant.
        Used for support purposes. The action is audit-logged automatically.
        """
        from django.contrib.auth import get_user_model
        from apps.accounts.models import UserMembership

        User = get_user_model()
        tenant = self.get_object()
        user_id = request.data.get("user_id")

        if not user_id:
            return Response(
                {"detail": "user_id is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)

        if not UserMembership.objects.filter(
            user=user, tenant=tenant, accepted_at__isnull=False
        ).exists():
            return Response(
                {"detail": "User is not a member of this tenant."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        refresh = RefreshToken.for_user(user)
        refresh["impersonated_by"] = str(request.user.id)
        refresh["impersonated_tenant"] = str(tenant.id)

        return Response({
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "impersonated_user": str(user.id),
            "impersonated_email": user.email,
            "tenant": str(tenant.id),
            "warning": "This token grants full access as the impersonated user. Use with care.",
        })

    # ------------------------------------------------------------------
    # Usage metrics
    # ------------------------------------------------------------------

    @extend_schema(tags=["Admin"], summary="Get usage metrics for a tenant")
    @action(detail=True, methods=["get"])
    def usage(self, request, pk=None):
        from apps.monitoring.models import Monitor
        from apps.incidents.models import Incident
        from apps.webhooks.models import Webhook, WebhookDelivery, DeliveryStatus
        from apps.audit.models import AuditLog

        tenant = self.get_object()
        data = {
            "tenant_id": str(tenant.id),
            "monitors": Monitor.objects.filter(tenant=tenant).count(),
            "active_incidents": Incident.objects.filter(
                tenant=tenant,
                resolved_at__isnull=True,
            ).count(),
            "members": tenant.memberships.filter(accepted_at__isnull=False).count(),
            "webhooks": Webhook.objects.filter(tenant=tenant).count(),
            "pending_deliveries": WebhookDelivery.objects.filter(
                tenant=tenant,
                status__in=(DeliveryStatus.PENDING, DeliveryStatus.FAILED),
            ).count(),
            "audit_log_entries": AuditLog.objects.filter(tenant=tenant).count(),
        }
        serializer = AdminTenantUsageSerializer(data=data)
        serializer.is_valid()
        return Response(serializer.data)


class AdminSystemViewSet(viewsets.ViewSet):
    """
    System-level health and metrics (super-admin only).
    """
    permission_classes = [IsSuperAdmin]

    @extend_schema(tags=["Admin"], summary="System health check")
    @action(detail=False, methods=["get"], url_path="health")
    def health(self, request):
        """Check DB connectivity, scheduler status, and webhook queue depth."""
        from apps.webhooks.models import WebhookDelivery, DeliveryStatus

        checks = {}

        # Database
        try:
            with connection.cursor() as cur:
                cur.execute("SELECT 1")
            checks["database"] = "ok"
        except Exception as exc:
            checks["database"] = f"error: {exc}"

        # Webhook queue depth
        try:
            pending = WebhookDelivery.objects.filter(
                status__in=(DeliveryStatus.PENDING, DeliveryStatus.FAILED)
            ).count()
            exhausted = WebhookDelivery.objects.filter(
                status=DeliveryStatus.EXHAUSTED
            ).count()
            checks["webhook_queue"] = {"pending": pending, "exhausted": exhausted}
        except Exception as exc:
            checks["webhook_queue"] = f"error: {exc}"

        overall = "ok" if checks.get("database") == "ok" else "degraded"
        return Response({
            "status": overall,
            "timestamp": timezone.now().isoformat(),
            "checks": checks,
        })

    @extend_schema(tags=["Admin"], summary="Global platform metrics")
    @action(detail=False, methods=["get"], url_path="metrics")
    def metrics(self, request):
        """Aggregate counts across all tenants."""
        from apps.tenancy.models import Tenant, Project
        from apps.monitoring.models import Monitor
        from apps.incidents.models import Incident
        from apps.accounts.models import User

        return Response({
            "tenants": {
                "total": Tenant.objects.count(),
                "active": Tenant.objects.filter(status="active").count(),
                "suspended": Tenant.objects.filter(status="suspended").count(),
            },
            "projects": Project.objects.count(),
            "monitors": {
                "total": Monitor.objects.count(),
                "operational": Monitor.objects.filter(status="operational").count(),
                "offline": Monitor.objects.filter(status="offline").count(),
                "paused": Monitor.objects.filter(is_paused=True).count(),
            },
            "incidents": {
                "total": Incident.objects.count(),
                "active": Incident.objects.filter(resolved_at__isnull=True).count(),
            },
            "users": User.objects.count(),
            "generated_at": timezone.now().isoformat(),
        })


class AdminAuditLogViewSet(viewsets.ViewSet):
    """
    Global cross-tenant audit log — super-admin only.
    Supports the same filters as the tenant-scoped /audit-log/ endpoint.
    """
    permission_classes = [IsSuperAdmin]

    @extend_schema(
        tags=["Admin"],
        summary="Global audit log (cross-tenant)",
    )
    @action(detail=False, methods=["get"], url_path="")
    def list_logs(self, request):
        from apps.audit.models import AuditLog

        qs = AuditLog.objects.select_related("project").all()

        params = request.query_params
        if tenant_id := params.get("tenant_id"):
            qs = qs.filter(tenant_id=tenant_id)
        if action_filter := params.get("action"):
            qs = qs.filter(action__icontains=action_filter)
        if resource_type := params.get("resource_type"):
            qs = qs.filter(resource_type=resource_type)
        if since := params.get("since"):
            qs = qs.filter(created_at__gte=since)
        if until := params.get("until"):
            qs = qs.filter(created_at__lte=until)

        qs = qs.order_by("-created_at")[:200]
        serializer = AuditLogSerializer(qs, many=True)
        return Response(serializer.data)
