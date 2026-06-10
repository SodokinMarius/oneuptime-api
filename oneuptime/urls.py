"""
Root URL configuration.
"""
from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)


def healthz(request):
    """Liveness probe — returns 200 if the process is up."""
    from django.http import JsonResponse
    return JsonResponse({'status': 'ok'})


urlpatterns = [
    # Admin
    path('admin/', admin.site.urls),

    # Health
    path('healthz', healthz, name='healthz'),

    # OpenAPI
    path('api/v1/openapi.json', SpectacularAPIView.as_view(), name='schema'),
    path('api/v1/docs', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger'),
    path('api/v1/redoc', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),

    # Apps
    path('api/v1/', include('apps.accounts.urls')),
    path('api/v1/', include('apps.rbac.urls')),
    path('api/v1/', include('apps.monitoring.urls')),
    path('api/v1/', include('apps.incidents.urls')),
    path('api/v1/', include('apps.maintenance.urls')),
    path('api/v1/', include('apps.webhooks.urls')),
    path('api/v1/', include('apps.tenancy.urls')),
    path('api/v1/', include('apps.audit.urls')),
    path('api/v1/', include('apps.status_pages.urls')),
    path('api/v1/', include('apps.admin_api.urls')),
    path('api/v1/', include('apps.sso.urls')),

    # SCIM 2.0 (bearer token auth, outside api/v1)
    path('scim/v2/', include('apps.sso.scim_urls')),
]