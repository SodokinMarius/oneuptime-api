"""ViewSets for incidents resources."""
from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.incidents.models import (
    Incident,
    IncidentPostmortem,
    IncidentSeverity,
    IncidentState,
)
from apps.incidents.serializers import (
    AddNoteSerializer,
    AssignIncidentSerializer,
    IncidentNoteSerializer,
    IncidentPostmortemSerializer,
    IncidentSerializer,
    IncidentSeveritySerializer,
    IncidentStateSerializer,
)
from apps.incidents import services
from apps.rbac.permissions import PermissionMixin

User = get_user_model()


class IncidentStateViewSet(PermissionMixin, viewsets.ModelViewSet):
    """Custom incident states per project."""
    serializer_class = IncidentStateSerializer
    permission_map = {
        "list":           "incident_state:read",
        "retrieve":       "incident_state:read",
        "create":         "incident_state:create",
        "update":         "incident_state:update",
        "partial_update": "incident_state:update",
        "destroy":        "incident_state:delete",
    }

    def get_queryset(self):
        project = getattr(self.request, "project", None)
        if project is None:
            return IncidentState.objects.none()
        return IncidentState.objects.filter(project=project).order_by("order")

    def perform_create(self, serializer):
        project = self.request.project
        serializer.save(tenant=project.tenant, project=project, is_system=False)

    def destroy(self, request, *args, **kwargs):
        state = self.get_object()
        if state.is_system:
            return Response(
                {"type": "conflict", "title": "Conflict", "status": 409,
                 "detail": "System states cannot be deleted."},
                status=status.HTTP_409_CONFLICT,
            )
        state.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class IncidentSeverityViewSet(PermissionMixin, viewsets.ModelViewSet):
    """Custom incident severities per project."""
    serializer_class = IncidentSeveritySerializer
    permission_map = {
        "list":           "incident_severity:read",
        "retrieve":       "incident_severity:read",
        "create":         "incident_severity:create",
        "update":         "incident_severity:update",
        "partial_update": "incident_severity:update",
        "destroy":        "incident_severity:delete",
    }

    def get_queryset(self):
        project = getattr(self.request, "project", None)
        if project is None:
            return IncidentSeverity.objects.none()
        return IncidentSeverity.objects.filter(project=project).order_by("order")

    def perform_create(self, serializer):
        project = self.request.project
        serializer.save(tenant=project.tenant, project=project, is_system=False)

    def destroy(self, request, *args, **kwargs):
        severity = self.get_object()
        if severity.is_system:
            return Response(
                {"type": "conflict", "title": "Conflict", "status": 409,
                 "detail": "System severities cannot be deleted."},
                status=status.HTTP_409_CONFLICT,
            )
        severity.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class IncidentViewSet(PermissionMixin, viewsets.ModelViewSet):
    """Full incident management: CRUD + lifecycle actions + notes + postmortem."""
    serializer_class = IncidentSerializer
    permission_map = {
        "list":            "incident:read",
        "retrieve":        "incident:read",
        "create":          "incident:create",
        "update":          "incident:update",
        "partial_update":  "incident:update",
        "destroy":         "incident:delete",
        "acknowledge":     "incident:acknowledge",
        "resolve":         "incident:resolve",
        "assign":          "incident:assign",
        "notes":           "incident:read",
        "add_note":        "incident:update",
        "timeline":        "incident:read",
        "get_postmortem":  "incident:read",
        "upsert_postmortem": "incident:postmortem",
    }

    def get_queryset(self):
        project = getattr(self.request, "project", None)
        if project is None:
            return Incident.objects.none()

        qs = Incident.objects.filter(project=project).select_related(
            "state", "severity", "monitor", "assigned_to"
        )
        params = self.request.query_params

        if s := params.get("state"):
            qs = qs.filter(state__name=s)
        if sv := params.get("severity"):
            qs = qs.filter(severity__name=sv)
        if m := params.get("monitor"):
            qs = qs.filter(monitor_id=m)
        if a := params.get("assignee"):
            qs = qs.filter(assigned_to_id=a)
        if resolved := params.get("resolved"):
            qs = qs.filter(state__is_resolved_state=(resolved.lower() == "true"))

        return qs.order_by("-triggered_at")

    def perform_create(self, serializer):
        project = self.request.project
        # Set default state to 'triggered' if not provided
        state = serializer.validated_data.get("state")
        if not state:
            from apps.incidents.models import IncidentState
            state = IncidentState.objects.filter(
                project=project, name="triggered"
            ).first()
        serializer.save(tenant=project.tenant, project=project, state=state)

    # ------------------------------------------------------------------
    # Lifecycle actions
    # ------------------------------------------------------------------

    @extend_schema(tags=["Incidents"], summary="Acknowledge an incident")
    @action(detail=True, methods=["post"])
    def acknowledge(self, request, pk=None):
        incident = self.get_object()
        if incident.is_resolved:
            return Response(
                {"detail": "Cannot acknowledge a resolved incident."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        incident = services.acknowledge_incident(incident, request.user)
        return Response(IncidentSerializer(incident).data)

    @extend_schema(tags=["Incidents"], summary="Resolve an incident")
    @action(detail=True, methods=["post"])
    def resolve(self, request, pk=None):
        incident = self.get_object()
        if incident.is_resolved:
            return Response(
                {"detail": "Incident is already resolved."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        incident = services.resolve_incident(incident, request.user)
        return Response(IncidentSerializer(incident).data)

    @extend_schema(
        tags=["Incidents"],
        summary="Assign an incident to a user",
        request=AssignIncidentSerializer,
    )
    @action(detail=True, methods=["post"])
    def assign(self, request, pk=None):
        incident = self.get_object()
        serializer = AssignIncidentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        assignee = get_object_or_404(User, id=serializer.validated_data["user_id"])
        incident = services.assign_incident(incident, assignee)
        return Response(IncidentSerializer(incident).data)

    # ------------------------------------------------------------------
    # Notes
    # ------------------------------------------------------------------

    @extend_schema(tags=["Incidents"], summary="List incident notes")
    @action(detail=True, methods=["get"])
    def notes(self, request, pk=None):
        incident = self.get_object()
        notes = incident.notes.select_related("author").order_by("created_at")
        return Response(IncidentNoteSerializer(notes, many=True).data)

    @extend_schema(
        tags=["Incidents"],
        summary="Add a note to an incident",
        request=AddNoteSerializer,
    )
    @action(detail=True, methods=["post"], url_path="notes")
    def add_note(self, request, pk=None):
        incident = self.get_object()
        serializer = AddNoteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        note = services.add_note(
            incident=incident,
            author=request.user,
            content=serializer.validated_data["content"],
            is_public=serializer.validated_data.get("is_public", False),
        )
        return Response(
            IncidentNoteSerializer(note).data,
            status=status.HTTP_201_CREATED,
        )

    # ------------------------------------------------------------------
    # Timeline
    # ------------------------------------------------------------------

    @extend_schema(tags=["Incidents"], summary="Get incident timeline")
    @action(detail=True, methods=["get"])
    def timeline(self, request, pk=None):
        incident = self.get_object()
        return Response({"timeline": services.build_timeline(incident)})

    # ------------------------------------------------------------------
    # Postmortem
    # ------------------------------------------------------------------

    @extend_schema(tags=["Incidents"], summary="Get incident postmortem")
    @action(detail=True, methods=["get"], url_path="postmortem")
    def get_postmortem(self, request, pk=None):
        incident = self.get_object()
        try:
            pm = incident.postmortem
        except IncidentPostmortem.DoesNotExist:
            return Response(
                {"detail": "No postmortem for this incident."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(IncidentPostmortemSerializer(pm).data)

    @extend_schema(
        tags=["Incidents"],
        summary="Create or update incident postmortem",
        request=IncidentPostmortemSerializer,
    )
    @action(detail=True, methods=["post", "put"], url_path="postmortem")
    def upsert_postmortem(self, request, pk=None):
        incident = self.get_object()
        try:
            pm = incident.postmortem
            serializer = IncidentPostmortemSerializer(pm, data=request.data, partial=True)
        except IncidentPostmortem.DoesNotExist:
            serializer = IncidentPostmortemSerializer(data=request.data)

        serializer.is_valid(raise_exception=True)

        # Publish if requested
        publish = request.data.get("publish", False)
        extra = {}
        if publish:
            extra["published_at"] = timezone.now()

        if serializer.instance:
            for attr, val in {**serializer.validated_data, **extra}.items():
                setattr(serializer.instance, attr, val)
            serializer.instance.save()
            pm = serializer.instance
            created = False
        else:
            pm = IncidentPostmortem.objects.create(
                tenant=incident.tenant,
                incident=incident,
                **serializer.validated_data,
                **extra,
            )
            created = True

        if pm.published_at:
            try:
                from apps.webhooks.services import WebhookService
                WebhookService.emit(
                    tenant=incident.tenant,
                    project=incident.project,
                    event_type="incident.postmortem_published",
                    payload={"incident": IncidentSerializer(incident).data},
                )
            except Exception:
                pass

        return Response(
            IncidentPostmortemSerializer(pm).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )
