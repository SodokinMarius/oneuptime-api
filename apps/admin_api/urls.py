"""URL routes for admin_api (super-admin endpoints)."""
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.admin_api.views import AdminAuditLogViewSet, AdminSystemViewSet, AdminTenantViewSet

router = DefaultRouter()
router.register(r"admin/tenants", AdminTenantViewSet, basename="admin-tenant")

urlpatterns = [
    path("", include(router.urls)),
    # System health + metrics
    path(
        "admin/system/",
        AdminSystemViewSet.as_view({"get": "health"}),
        kwargs={"action": "health"},
        name="admin-system-health",
    ),
    path(
        "admin/system/health",
        AdminSystemViewSet.as_view({"get": "health"}),
        name="admin-system-health-direct",
    ),
    path(
        "admin/system/metrics",
        AdminSystemViewSet.as_view({"get": "metrics"}),
        name="admin-system-metrics",
    ),
    # Global audit log
    path(
        "admin/audit-log",
        AdminAuditLogViewSet.as_view({"get": "list_logs"}),
        name="admin-audit-log",
    ),
]
