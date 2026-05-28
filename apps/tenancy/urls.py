"""URL routes for tenancy app."""
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.tenancy.views import ProjectViewSet, TenantViewSet

router = DefaultRouter()
router.register(r"tenants", TenantViewSet, basename="tenant")
router.register(r"projects", ProjectViewSet, basename="project")

urlpatterns = [
    path("", include(router.urls)),
]
