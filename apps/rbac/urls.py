"""URL routes for RBAC app."""
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.rbac.views import ApiKeyViewSet, ResourcePolicyViewSet, RoleViewSet, TeamViewSet

router = DefaultRouter()
router.register(r"roles", RoleViewSet, basename="role")
router.register(r"teams", TeamViewSet, basename="team")
router.register(r"api-keys", ApiKeyViewSet, basename="api-key")
router.register(r"resource-policies", ResourcePolicyViewSet, basename="resource-policy")

urlpatterns = [
    path("", include(router.urls)),
]
