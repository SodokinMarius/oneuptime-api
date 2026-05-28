"""URL routes for webhooks app."""
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.webhooks.views import WebhookViewSet

router = DefaultRouter()
router.register(r"webhooks", WebhookViewSet, basename="webhook")

urlpatterns = [
    path("", include(router.urls)),
]
