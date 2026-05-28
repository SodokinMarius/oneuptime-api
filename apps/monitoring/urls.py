"""URL routes for monitoring app."""
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.monitoring.views import MonitorGroupViewSet, MonitorViewSet, ProbeViewSet

router = DefaultRouter()
router.register(r"monitors", MonitorViewSet, basename="monitor")
router.register(r"monitor-groups", MonitorGroupViewSet, basename="monitor-group")
router.register(r"probes", ProbeViewSet, basename="probe")

urlpatterns = [
    path("", include(router.urls)),
]
