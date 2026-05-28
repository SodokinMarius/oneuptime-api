"""URL routes for status_pages app."""
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.status_pages.views import StatusPagePublicViewSet, StatusPageViewSet

router = DefaultRouter()
router.register(r"status-pages", StatusPageViewSet, basename="status-page")

# Public router — no auth, accessible at /status/<slug>/
public_router = DefaultRouter()
public_router.register(r"", StatusPagePublicViewSet, basename="status-page-public")

urlpatterns = [
    path("", include(router.urls)),
    path("status/", include(public_router.urls)),
]
