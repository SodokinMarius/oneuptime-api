"""ViewSets for escalation policies and workflow rules."""
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.incidents.models import EscalationPolicy, EscalationStep, IncidentWorkflowRule
from apps.incidents.serializers import (
    EscalationPolicySerializer,
    EscalationStepSerializer,
    EscalationStepWriteSerializer,
    IncidentWorkflowRuleSerializer,
)
from apps.rbac.permissions import PermissionMixin
from core.team_scoping import TeamScopedViewMixin


class EscalationPolicyViewSet(TeamScopedViewMixin, PermissionMixin, viewsets.ModelViewSet):
    serializer_class = EscalationPolicySerializer
    permission_map = {
        "list": "incident:read",
        "retrieve": "incident:read",
        "create": "incident:update",
        "update": "incident:update",
        "partial_update": "incident:update",
        "destroy": "incident:update",
        "steps": "incident:read",
        "add_step": "incident:update",
        "remove_step": "incident:update",
    }

    def get_queryset(self):
        project = getattr(self.request, "project", None)
        if project is None:
            return EscalationPolicy.objects.none()
        qs = EscalationPolicy.objects.filter(project=project).prefetch_related("steps")
        return self.scope_queryset_by_team(qs).order_by("name")

    def perform_create(self, serializer):
        project = self.request.project
        serializer.save(
            tenant=project.tenant,
            project=project,
            **self.team_save_kwargs(serializer),
        )

    @extend_schema(tags=["Incidents"], summary="List escalation steps")
    @action(detail=True, methods=["get"], url_path="steps")
    def steps(self, request, pk=None):
        policy = self.get_object()
        data = EscalationStepSerializer(policy.steps.all(), many=True).data
        return Response(data)

    @extend_schema(
        tags=["Incidents"],
        summary="Add an escalation step",
        request=EscalationStepWriteSerializer,
    )
    @action(detail=True, methods=["post"], url_path="steps")
    def add_step(self, request, pk=None):
        policy = self.get_object()
        serializer = EscalationStepWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        step = EscalationStep.objects.create(policy=policy, **serializer.validated_data)
        return Response(EscalationStepSerializer(step).data, status=status.HTTP_201_CREATED)

    @extend_schema(tags=["Incidents"], summary="Remove an escalation step")
    @action(detail=True, methods=["delete"], url_path="steps/(?P<step_id>[^/.]+)")
    def remove_step(self, request, pk=None, step_id=None):
        policy = self.get_object()
        step = get_object_or_404(EscalationStep, policy=policy, id=step_id)
        step.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class IncidentWorkflowRuleViewSet(PermissionMixin, viewsets.ModelViewSet):
    serializer_class = IncidentWorkflowRuleSerializer
    permission_map = {
        "list": "incident:read",
        "retrieve": "incident:read",
        "create": "incident:update",
        "update": "incident:update",
        "partial_update": "incident:update",
        "destroy": "incident:update",
    }

    def get_queryset(self):
        project = getattr(self.request, "project", None)
        if project is None:
            return IncidentWorkflowRule.objects.none()
        return IncidentWorkflowRule.objects.filter(project=project).order_by("name")

    def perform_create(self, serializer):
        project = self.request.project
        serializer.save(tenant=project.tenant, project=project)
