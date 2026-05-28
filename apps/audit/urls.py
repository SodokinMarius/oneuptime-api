"""URL routes for audit app."""
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.audit.views import AuditLogViewSet, RetentionPolicyViewSet

router = DefaultRouter()
router.register(r"audit-log", AuditLogViewSet, basename="audit-log")
router.register(r"retention-policies", RetentionPolicyViewSet, basename="retention-policy")

urlpatterns = [
    path("", include(router.urls)),
]
