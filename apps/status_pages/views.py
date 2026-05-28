"""ViewSets for status_pages resources."""
import secrets

from drf_spectacular.utils import extend_schema
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from apps.rbac.permissions import PermissionMixin
from apps.status_pages.models import (
    StatusPage,
    StatusPageAnnouncement,
    StatusPageResource,
    StatusPageSubscriber,
)
from apps.status_pages.serializers import (
    StatusPageAnnouncementSerializer,
    StatusPagePublicSerializer,
    StatusPageResourceSerializer,
    StatusPageSerializer,
    StatusPageSubscriberSerializer,
)


class StatusPageViewSet(PermissionMixin, viewsets.ModelViewSet):
    """
    Full CRUD for status pages within a project.
    Manage resources, announcements, and view subscribers.
    """
    serializer_class = StatusPageSerializer
    permission_map = {
        "list":              "status_page:read",
        "retrieve":          "status_page:read",
        "create":            "status_page:create",
        "update":            "status_page:update",
        "partial_update":    "status_page:update",
        "destroy":           "status_page:delete",
        "resources":         "status_page:read",
        "add_resource":      "status_page:update",
        "remove_resource":   "status_page:update",
        "announcements":     "status_page:read",
        "add_announcement":  "status_page:update",
        "subscribers":       "status_page:read",
        "remove_subscriber": "status_page:manage_subscribers",
        "update_branding":   "status_page:update",
        "update_domain":     "status_page:update",
    }

    def get_queryset(self):
        project = getattr(self.request, "project", None)
        if project is None:
            return StatusPage.objects.none()
        return (
            StatusPage.objects
            .filter(project=project)
            .prefetch_related("resources__monitor", "resources__monitor_group")
            .order_by("name")
        )

    def perform_create(self, serializer):
        project = self.request.project
        serializer.save(tenant=project.tenant, project=project)

    # ------------------------------------------------------------------
    # Resources
    # ------------------------------------------------------------------

    @extend_schema(tags=["Status Pages"], summary="List resources on a status page")
    @action(detail=True, methods=["get"])
    def resources(self, request, pk=None):
        page = self.get_object()
        qs = (
            StatusPageResource.objects
            .filter(status_page=page)
            .select_related("monitor", "monitor_group")
            .order_by("order")
        )
        return Response(StatusPageResourceSerializer(qs, many=True).data)

    @extend_schema(tags=["Status Pages"], summary="Add a resource to a status page")
    @action(detail=True, methods=["post"], url_path="resources")
    def add_resource(self, request, pk=None):
        page = self.get_object()
        serializer = StatusPageResourceSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        serializer.save(tenant=page.tenant, status_page=page)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @extend_schema(tags=["Status Pages"], summary="Remove a resource from a status page")
    @action(
        detail=True, methods=["delete"],
        url_path=r"resources/(?P<resource_id>[^/.]+)",
    )
    def remove_resource(self, request, pk=None, resource_id=None):
        page = self.get_object()
        try:
            resource = StatusPageResource.objects.get(id=resource_id, status_page=page)
        except StatusPageResource.DoesNotExist:
            return Response({"detail": "Resource not found."}, status=status.HTTP_404_NOT_FOUND)
        resource.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    # ------------------------------------------------------------------
    # Announcements
    # ------------------------------------------------------------------

    @extend_schema(tags=["Status Pages"], summary="List announcements for a status page")
    @action(detail=True, methods=["get"])
    def announcements(self, request, pk=None):
        page = self.get_object()
        qs = StatusPageAnnouncement.objects.filter(status_page=page).order_by("-starts_at")
        return Response(StatusPageAnnouncementSerializer(qs, many=True).data)

    @extend_schema(tags=["Status Pages"], summary="Add an announcement to a status page")
    @action(detail=True, methods=["post"], url_path="announcements")
    def add_announcement(self, request, pk=None):
        page = self.get_object()
        serializer = StatusPageAnnouncementSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save(tenant=page.tenant, status_page=page)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    # ------------------------------------------------------------------
    # Subscribers (read-only from management side)
    # ------------------------------------------------------------------

    @extend_schema(tags=["Status Pages"], summary="List verified subscribers")
    @action(detail=True, methods=["get"])
    def subscribers(self, request, pk=None):
        page = self.get_object()
        qs = StatusPageSubscriber.objects.filter(status_page=page, is_verified=True)
        return Response(StatusPageSubscriberSerializer(qs, many=True).data)

    @extend_schema(tags=["Status Pages"], summary="Remove a subscriber")
    @action(
        detail=True, methods=["delete"],
        url_path=r"subscribers/(?P<subscriber_id>[^/.]+)",
    )
    def remove_subscriber(self, request, pk=None, subscriber_id=None):
        page = self.get_object()
        try:
            subscriber = StatusPageSubscriber.objects.get(id=subscriber_id, status_page=page)
        except StatusPageSubscriber.DoesNotExist:
            return Response({"detail": "Subscriber not found."}, status=status.HTTP_404_NOT_FOUND)
        subscriber.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @extend_schema(
        tags=["Status Pages"],
        summary="Update branding (logo, colors, custom CSS)",
        request={"application/json": {
            "type": "object",
            "properties": {
                "logo_url": {"type": "string"},
                "primary_color": {"type": "string"},
                "custom_css": {"type": "string"},
            },
        }},
    )
    @action(detail=True, methods=["put", "patch"], url_path="branding")
    def update_branding(self, request, pk=None):
        page = self.get_object()
        allowed = {"logo_url", "primary_color", "custom_css"}
        data = {k: v for k, v in request.data.items() if k in allowed}
        if not data:
            return Response(
                {"detail": "Provide at least one of: logo_url, primary_color, custom_css."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        for field, value in data.items():
            setattr(page, field, value)
        page.save(update_fields=list(data.keys()) + ["updated_at"])
        from apps.status_pages.serializers import StatusPageSerializer
        return Response(StatusPageSerializer(page).data)

    @extend_schema(
        tags=["Status Pages"],
        summary="Configure custom domain",
        request={"application/json": {
            "type": "object",
            "required": ["custom_domain"],
            "properties": {"custom_domain": {"type": "string"}},
        }},
    )
    @action(detail=True, methods=["put"], url_path="domain")
    def update_domain(self, request, pk=None):
        page = self.get_object()
        domain = request.data.get("custom_domain", "").strip()
        page.custom_domain = domain or None
        page.save(update_fields=["custom_domain", "updated_at"])
        return Response({"custom_domain": page.custom_domain})


class StatusPagePublicViewSet(
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    """
    Public status page endpoint — no authentication required.
    Accessible via /status/<slug>/ for embedding or rendering public pages.
    """
    serializer_class = StatusPagePublicSerializer
    permission_classes = [AllowAny]
    lookup_field = "slug"

    def get_queryset(self):
        return (
            StatusPage.objects
            .filter(is_public=True)
            .prefetch_related(
                "resources__monitor",
                "resources__monitor_group",
                "announcements",
            )
        )

    @extend_schema(
        tags=["Status Pages (Public)"],
        summary="Get public status page by slug",
        description=(
            "Returns the public status page with its resources and active announcements. "
            "No authentication required."
        ),
    )
    def retrieve(self, request, *args, **kwargs):
        return super().retrieve(request, *args, **kwargs)

    @extend_schema(
        tags=["Status Pages (Public)"],
        summary="Subscribe to a status page",
        description=(
            "Subscribe an email address to receive notifications for this status page. "
            "A verification email will be sent."
        ),
    )
    @action(detail=True, methods=["post"])
    def subscribe(self, request, slug=None):
        page = self.get_object()
        serializer = StatusPageSubscriberSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        subscriber, created = StatusPageSubscriber.objects.get_or_create(
            status_page=page,
            email=serializer.validated_data["email"],
            defaults={
                "tenant": page.tenant,
                "verification_token": secrets.token_urlsafe(32),
                "is_verified": False,
            },
        )

        if created:
            return Response(
                {"detail": "Subscribed. Please check your email to verify."},
                status=status.HTTP_201_CREATED,
            )
        return Response({"detail": "This email is already subscribed."})
