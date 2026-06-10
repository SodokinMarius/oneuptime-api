"""SSO app URL routing."""
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.sso.views import (
    SSOACSView,
    SSOConfigViewSet,
    SSODiscoverView,
    SSOLoginView,
    SSOMetadataView,
    SSOSLOView,
)

router = DefaultRouter()
router.register(r"sso/config", SSOConfigViewSet, basename="sso-config")

urlpatterns = [
    path("sso/discover/", SSODiscoverView.as_view(), name="sso-discover"),
    path("sso/metadata/<uuid:project_id>/", SSOMetadataView.as_view(), name="sso-metadata"),
    path("sso/login/<uuid:project_id>/", SSOLoginView.as_view(), name="sso-login"),
    path("sso/acs/<uuid:project_id>/", SSOACSView.as_view(), name="sso-acs"),
    path("sso/slo/<uuid:project_id>/", SSOSLOView.as_view(), name="sso-slo"),
    path("", include(router.urls)),
]
