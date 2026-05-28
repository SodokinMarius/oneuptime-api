"""URL routes for maintenance app."""
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.maintenance.views import ScheduledMaintenanceViewSet

router = DefaultRouter()
router.register(r"scheduled-maintenance", ScheduledMaintenanceViewSet, basename="scheduled-maintenance")

urlpatterns = [
    path("", include(router.urls)),
]
