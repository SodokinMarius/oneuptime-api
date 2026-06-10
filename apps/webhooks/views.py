"""ViewSets for webhooks resources."""
from drf_spectacular.utils import extend_schema
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.rbac.permissions import PermissionMixin
from apps.webhooks.models import Webhook, WebhookDelivery
from core.team_scoping import TeamScopedViewMixin
from apps.webhooks.serializers import WebhookDeliverySerializer, WebhookSerializer


class WebhookViewSet(TeamScopedViewMixin, PermissionMixin, viewsets.ModelViewSet):
    """
    CRUD for outbound webhooks plus delivery history.

    Webhooks are signed with HMAC-SHA256. The secret is write-only and
    auto-generated if not provided at creation time.
    """
    serializer_class = WebhookSerializer
    permission_map = {
        "list":           "webhook:read",
        "retrieve":       "webhook:read",
        "create":         "webhook:create",
        "update":         "webhook:update",
        "partial_update": "webhook:update",
        "destroy":        "webhook:delete",
        "deliveries":     "webhook:read",
        "retry":          "webhook:update",
    }

    def get_queryset(self):
        project = getattr(self.request, "project", None)
        if project is None:
            return Webhook.objects.none()
        qs = Webhook.objects.filter(project=project)
        if active := self.request.query_params.get("active"):
            qs = qs.filter(is_active=active.lower() == "true")
        return self.scope_queryset_by_team(qs).order_by("-created_at")

    def perform_create(self, serializer):
        project = self.request.project
        serializer.save(
            tenant=project.tenant,
            project=project,
            **self.team_save_kwargs(serializer),
        )

    @extend_schema(tags=["Webhooks"], summary="List deliveries for a webhook")
    @action(detail=True, methods=["get"])
    def deliveries(self, request, pk=None):
        """Return the last 100 delivery attempts for this webhook."""
        webhook = self.get_object()
        qs = (
            WebhookDelivery.objects
            .filter(webhook=webhook)
            .order_by("-created_at")[:100]
        )
        serializer = WebhookDeliverySerializer(qs, many=True)
        return Response(serializer.data)

    @extend_schema(tags=["Webhooks"], summary="Manually retry an exhausted delivery")
    @action(detail=True, methods=["post"], url_path="deliveries/(?P<delivery_id>[^/.]+)/retry")
    def retry(self, request, pk=None, delivery_id=None):
        """Reset an exhausted delivery back to pending so the scheduler retries it."""
        from django.utils import timezone
        from apps.webhooks.models import DeliveryStatus

        webhook = self.get_object()
        try:
            delivery = WebhookDelivery.objects.get(id=delivery_id, webhook=webhook)
        except WebhookDelivery.DoesNotExist:
            return Response({"detail": "Delivery not found."}, status=status.HTTP_404_NOT_FOUND)

        if delivery.status not in (DeliveryStatus.EXHAUSTED, DeliveryStatus.FAILED):
            return Response(
                {"detail": "Only exhausted or failed deliveries can be retried."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        delivery.status = DeliveryStatus.PENDING
        delivery.next_retry_at = timezone.now()
        delivery.attempt_count = 0
        delivery.save(update_fields=["status", "next_retry_at", "attempt_count", "updated_at"])
        return Response({"detail": "Delivery reset to pending."})
