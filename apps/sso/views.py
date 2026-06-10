"""
SSO / SAML / SCIM API views.

SAML endpoints (public, no JWT):
  GET  /api/v1/sso/metadata/<project_id>/   — SP metadata XML
  GET  /api/v1/sso/login/<project_id>/      — Initiate SAML (redirect to IdP)
  POST /api/v1/sso/acs/<project_id>/        — Assertion Consumer Service
  GET  /api/v1/sso/discover/                — Find SSO configs by email

SCIM endpoints (bearer token):
  /scim/v2/Users, /scim/v2/Groups, /scim/v2/ServiceProviderConfig, etc.
"""
from urllib.parse import urlencode

from django.conf import settings as django_settings
from django.contrib.auth import get_user_model
from django.http import HttpResponse, HttpResponseRedirect
from django.shortcuts import get_object_or_404
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.serializers import UserSerializer
from apps.rbac.permissions import PermissionMixin
from apps.sso.authentication import SCIMAuthentication
from apps.sso.models import SCIMSyncLog, SSOConfig
from apps.sso.serializers import (
    PROVIDER_PRESETS,
    SCIMSyncLogSerializer,
    SSODiscoverSerializer,
    SSOConfigCreateSerializer,
    SSOConfigDetailSerializer,
    SSOConfigSerializer,
)
from apps.sso.services.jit import JITProvisioner
from apps.sso.services.saml import SAMLService, SAMLServiceError
from apps.sso.services.scim import SCIMService, SCIM_LIST_SCHEMA, SCIM_SCHEMA_GROUP, SCIM_SCHEMA_USER
User = get_user_model()


def _require_project(request):
    project = getattr(request, "project", None)
    if project is None:
        raise ValidationError(
            "No project context found. Send the X-Project-Id header."
        )
    return project


def _get_enabled_sso_config(project_id) -> SSOConfig:
    return get_object_or_404(
        SSOConfig.objects.select_related("project", "tenant", "default_role"),
        project_id=project_id,
        is_enabled=True,
    )


def _issue_sso_tokens(user, project_id: str) -> dict:
    """Issue JWT with SSO auth markers for enforce_sso enforcement."""
    refresh = RefreshToken.for_user(user)
    refresh["auth_method"] = "sso"
    sso_projects = list(refresh.get("sso_projects", []))
    pid = str(project_id)
    if pid not in sso_projects:
        sso_projects.append(pid)
    refresh["sso_projects"] = sso_projects
    return {
        "access": str(refresh.access_token),
        "refresh": str(refresh),
    }


def _client_ip(request):
    xff = request.META.get("HTTP_X_FORWARDED_FOR")
    if xff:
        return xff.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


# ---------------------------------------------------------------------------
# SSO Config management (authenticated)
# ---------------------------------------------------------------------------

class SSOConfigViewSet(PermissionMixin, viewsets.ModelViewSet):
    """CRUD for project SAML/SCIM configuration."""

    permission_map = {
        "list": "project:manage_sso",
        "retrieve": "project:manage_sso",
        "create": "project:manage_sso",
        "update": "project:manage_sso",
        "partial_update": "project:manage_sso",
        "destroy": "project:manage_sso",
        "regenerate_scim_token": "project:manage_sso",
        "scim_logs": "project:manage_sso",
        "provider_presets": "project:manage_sso",
    }

    def get_serializer_class(self):
        if self.action == "create":
            return SSOConfigCreateSerializer
        if self.action == "retrieve":
            return SSOConfigDetailSerializer
        return SSOConfigSerializer

    def get_queryset(self):
        project = getattr(self.request, "project", None)
        if project is None:
            return SSOConfig.objects.none()
        return SSOConfig.objects.filter(project=project).prefetch_related("default_teams")

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["project"] = getattr(self.request, "project", None)
        return ctx

    def perform_create(self, serializer):
        project = _require_project(self.request)
        serializer.save(tenant=project.tenant, project=project)

    @extend_schema(tags=["SSO"], summary="Regenerate SCIM bearer token")
    @action(detail=True, methods=["post"], url_path="regenerate-scim-token")
    def regenerate_scim_token(self, request, pk=None):
        config = self.get_object()
        token = config.regenerate_scim_token()
        return Response({"scim_token": token})

    @extend_schema(tags=["SSO"], summary="List SCIM sync logs")
    @action(detail=True, methods=["get"], url_path="scim-logs")
    def scim_logs(self, request, pk=None):
        config = self.get_object()
        logs = SCIMSyncLog.objects.filter(config=config)[:100]
        return Response(SCIMSyncLogSerializer(logs, many=True).data)

    @extend_schema(tags=["SSO"], summary="IdP attribute presets")
    @action(detail=False, methods=["get"], url_path="provider-presets")
    def provider_presets(self, request):
        return Response(PROVIDER_PRESETS)


# ---------------------------------------------------------------------------
# SAML public endpoints
# ---------------------------------------------------------------------------

class SSOMetadataView(APIView):
    """Return SP SAML metadata XML for IdP configuration."""
    permission_classes = [AllowAny]

    @extend_schema(tags=["SSO"], summary="SP SAML metadata XML")
    def get(self, request, project_id):
        config = _get_enabled_sso_config(project_id)
        try:
            xml = SAMLService(config).get_metadata_xml()
        except Exception as exc:
            return Response(
                {"detail": f"Cannot generate metadata: {exc}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        return HttpResponse(xml, content_type="application/xml")


class SSOLoginView(APIView):
    """SP-initiated SAML login — redirects to IdP."""
    permission_classes = [AllowAny]

    @extend_schema(tags=["SSO"], summary="Initiate SAML login (redirect to IdP)")
    def get(self, request, project_id):
        config = _get_enabled_sso_config(project_id)
        try:
            url = SAMLService(config).get_login_redirect_url(request)
        except Exception as exc:
            return Response(
                {"detail": f"Cannot initiate SAML login: {exc}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        return HttpResponseRedirect(url)


class SSOACSView(APIView):
    """Assertion Consumer Service — validates SAML and issues JWT."""
    permission_classes = [AllowAny]

    @extend_schema(tags=["SSO"], summary="SAML Assertion Consumer Service")
    def post(self, request, project_id):
        config = _get_enabled_sso_config(project_id)
        saml = SAMLService(config)
        try:
            attrs = saml.process_acs(request)
        except SAMLServiceError as exc:
            if request.POST.get("SAMLResponse") or request.GET.get("SAMLResponse"):
                params = urlencode({"error": str(exc)})
                return HttpResponseRedirect(f"{django_settings.FRONTEND_URL}/sso/callback?{params}")
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = JITProvisioner.provision_from_saml(
                config,
                email=attrs["email"],
                first_name=attrs.get("first_name", ""),
                last_name=attrs.get("last_name", ""),
            )
        except ValueError as exc:
            if request.POST.get("SAMLResponse") or request.GET.get("SAMLResponse"):
                params = urlencode({"error": str(exc)})
                return HttpResponseRedirect(f"{django_settings.FRONTEND_URL}/sso/callback?{params}")
            return Response({"detail": str(exc)}, status=status.HTTP_403_FORBIDDEN)

        user.last_login = timezone.now()
        user.last_login_ip = _client_ip(request)
        user.save(update_fields=["last_login", "last_login_ip"])

        tokens = _issue_sso_tokens(user, project_id)
        payload = {
            "user": UserSerializer(user).data,
            **tokens,
            "auth_method": "sso",
        }

        # Browser SAML flow (IdP form POST/GET) → redirect to SPA callback
        if request.POST.get("SAMLResponse") or request.GET.get("SAMLResponse"):
            params = urlencode({
                "access": tokens["access"],
                "refresh": tokens["refresh"],
                "auth_method": "sso",
                "project_id": str(project_id),
            })
            return HttpResponseRedirect(f"{django_settings.FRONTEND_URL}/sso/callback?{params}")

        return Response(payload)

    def get(self, request, project_id):
        """Some IdPs send SAMLResponse via HTTP-Redirect (GET)."""
        return self.post(request, project_id)


class SSODiscoverView(APIView):
    """Discover enabled SSO configs for a user by email."""
    permission_classes = [AllowAny]

    @extend_schema(tags=["SSO"], request=SSODiscoverSerializer, summary="Discover SSO by email")
    def get(self, request):
        serializer = SSODiscoverSerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"]

        from apps.rbac.models import TeamMembership

        project_ids = TeamMembership.objects.filter(
            user__email__iexact=email
        ).values_list("team__project_id", flat=True).distinct()

        configs = SSOConfig.objects.filter(
            project_id__in=project_ids,
            is_enabled=True,
        ).select_related("project")

        results = []
        for cfg in configs:
            sp = SAMLService(cfg).sp_info()
            results.append({
                "project_id": str(cfg.project_id),
                "project_name": cfg.project.name,
                "provider": cfg.provider,
                "name": cfg.name,
                "login_url": f"/api/v1/sso/login/{cfg.project_id}/",
                "sp_entity_id": sp["entity_id"],
            })
        return Response({"email": email, "sso_configs": results})


class SSOSLOView(APIView):
    """Single Logout — redirects to IdP if configured."""
    permission_classes = [AllowAny]

    @extend_schema(tags=["SSO"], summary="Initiate SAML Single Logout")
    def get(self, request, project_id):
        config = _get_enabled_sso_config(project_id)
        name_id = request.GET.get("name_id", "")
        session_index = request.GET.get("session_index", "")
        url = SAMLService(config).get_logout_redirect_url(request, name_id, session_index)
        if url:
            return HttpResponseRedirect(url)
        return Response({"detail": "SLO not configured for this IdP."})


# ---------------------------------------------------------------------------
# SCIM 2.0 endpoints
# ---------------------------------------------------------------------------

class SCIMBaseView(APIView):
    authentication_classes = [SCIMAuthentication]
    permission_classes = [AllowAny]

    def get_scim_service(self, request) -> SCIMService:
        return SCIMService(request.sso_config)


class SCIMServiceProviderConfigView(SCIMBaseView):
    def get(self, request):
        return Response({
            "schemas": ["urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig"],
            "patch": {"supported": True},
            "bulk": {"supported": False},
            "filter": {"supported": True, "maxResults": 200},
            "changePassword": {"supported": False},
            "sort": {"supported": False},
            "etag": {"supported": False},
            "authenticationSchemes": [{
                "type": "oauthbearertoken",
                "name": "Bearer Token",
                "description": "SCIM bearer token from SSO config",
            }],
        })


class SCIMSchemasView(SCIMBaseView):
    def get(self, request):
        return Response({
            "schemas": [SCIM_LIST_SCHEMA],
            "totalResults": 2,
            "Resources": [
                {"id": SCIM_SCHEMA_USER, "name": "User"},
                {"id": SCIM_SCHEMA_GROUP, "name": "Group"},
            ],
        })


class SCIMUsersView(SCIMBaseView):
    def get(self, request, user_id=None):
        svc = self.get_scim_service(request)
        if user_id:
            data = svc.get_user(user_id)
            if not data:
                return Response(status=status.HTTP_404_NOT_FOUND)
            return Response(data)
        filter_expr = request.GET.get("filter")
        users = svc.list_users(filter_expr)
        return Response({
            "schemas": [SCIM_LIST_SCHEMA],
            "totalResults": len(users),
            "Resources": users,
        })

    def post(self, request):
        svc = self.get_scim_service(request)
        try:
            data = svc.create_user(request.data)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(data, status=status.HTTP_201_CREATED)

    def put(self, request, user_id=None):
        if not user_id:
            return Response(status=status.HTTP_405_METHOD_NOT_ALLOWED)
        svc = self.get_scim_service(request)
        data = svc.update_user(user_id, request.data)
        if not data:
            return Response(status=status.HTTP_404_NOT_FOUND)
        return Response(data)

    def patch(self, request, user_id=None):
        if not user_id:
            return Response(status=status.HTTP_405_METHOD_NOT_ALLOWED)
        svc = self.get_scim_service(request)
        data = svc.update_user(user_id, request.data)
        if not data:
            return Response(status=status.HTTP_404_NOT_FOUND)
        return Response(data)

    def delete(self, request, user_id=None):
        if not user_id:
            return Response(status=status.HTTP_405_METHOD_NOT_ALLOWED)
        svc = self.get_scim_service(request)
        if not svc.delete_user(user_id):
            return Response(status=status.HTTP_404_NOT_FOUND)
        return Response(status=status.HTTP_204_NO_CONTENT)


class SCIMGroupsView(SCIMBaseView):
    def get(self, request, group_id=None):
        svc = self.get_scim_service(request)
        if group_id:
            data = svc.get_group(group_id)
            if not data:
                return Response(status=status.HTTP_404_NOT_FOUND)
            return Response(data)
        filter_expr = request.GET.get("filter")
        groups = svc.list_groups(filter_expr)
        return Response({
            "schemas": [SCIM_LIST_SCHEMA],
            "totalResults": len(groups),
            "Resources": groups,
        })

    def post(self, request):
        svc = self.get_scim_service(request)
        try:
            data = svc.create_group(request.data)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(data, status=status.HTTP_201_CREATED)

    def put(self, request, group_id=None):
        if not group_id:
            return Response(status=status.HTTP_405_METHOD_NOT_ALLOWED)
        svc = self.get_scim_service(request)
        data = svc.replace_group(group_id, request.data)
        if not data:
            return Response(status=status.HTTP_404_NOT_FOUND)
        return Response(data)

    def patch(self, request, group_id=None):
        if not group_id:
            return Response(status=status.HTTP_405_METHOD_NOT_ALLOWED)
        svc = self.get_scim_service(request)
        operations = request.data.get("Operations", [])
        data = svc.patch_group(group_id, operations)
        if not data:
            return Response(status=status.HTTP_404_NOT_FOUND)
        return Response(data)

    def delete(self, request, group_id=None):
        if not group_id:
            return Response(status=status.HTTP_405_METHOD_NOT_ALLOWED)
        svc = self.get_scim_service(request)
        if not svc.delete_group(group_id):
            return Response(status=status.HTTP_404_NOT_FOUND)
        return Response(status=status.HTTP_204_NO_CONTENT)
