"""Tests for incident escalation policies and workflow rules."""
from datetime import timedelta
from unittest.mock import patch

import pytest
from django.utils import timezone

from apps.accounts.services.onboarding import OnboardingService
from apps.incidents.models import (
    EscalationPolicy,
    EscalationStep,
    Incident,
    IncidentEscalationState,
    IncidentSeverity,
    IncidentState,
    IncidentWorkflowRule,
)
from apps.incidents.services.escalation import (
    attach_escalation_policy,
    process_escalations,
)
from apps.incidents.services.lifecycle import acknowledge_incident, emit_incident_created
from apps.incidents.services.workflows import process_unacknowledged_workflows, run_workflow_rules
from apps.rbac.services import bootstrap_project


@pytest.fixture
def project_context(db):
    user, tenant, project = OnboardingService.create_account(
        email="escalation@example.com",
        password="SecurePass123!",
        tenant_name="Escalation Corp",
    )
    user.is_active = True
    user.is_email_verified = True
    user.save()
    bootstrap_project(project, tenant)
    return user, tenant, project


def _create_incident(project_context, **kwargs):
    user, tenant, project = project_context
    severity = kwargs.pop(
        "severity",
        IncidentSeverity.objects.get(project=project, name="critical"),
    )
    state = kwargs.pop(
        "state",
        IncidentState.objects.get(project=project, name="triggered"),
    )
    return Incident.objects.create(
        tenant=tenant,
        project=project,
        title=kwargs.pop("title", "API down"),
        description=kwargs.pop("description", "Service unavailable"),
        severity=severity,
        state=state,
        **kwargs,
    )


@pytest.mark.django_db
class TestEscalationPolicy:
    def test_attach_default_policy_on_incident(self, project_context):
        user, tenant, project = project_context
        policy = EscalationPolicy.objects.create(
            tenant=tenant,
            project=project,
            name="Default",
            is_default=True,
            is_active=True,
        )
        EscalationStep.objects.create(
            policy=policy,
            order=1,
            delay_minutes=15,
            action=EscalationStep.Action.NOTIFY_USER,
            user=user,
        )
        incident = _create_incident(project_context)

        state = attach_escalation_policy(incident)

        assert state is not None
        assert state.policy_id == policy.id
        assert state.current_step_order == 0
        assert state.completed is False

    def test_escalation_step_runs_after_delay(self, project_context):
        user, tenant, project = project_context
        policy = EscalationPolicy.objects.create(
            tenant=tenant,
            project=project,
            name="Default",
            is_default=True,
            is_active=True,
        )
        EscalationStep.objects.create(
            policy=policy,
            order=1,
            delay_minutes=0,
            action=EscalationStep.Action.ASSIGN_USER,
            user=user,
        )
        incident = _create_incident(project_context)
        attach_escalation_policy(incident)

        stats = process_escalations()

        incident.refresh_from_db()
        assert stats["escalated"] == 1
        assert incident.assigned_to_id == user.id
        state = IncidentEscalationState.objects.get(incident=incident)
        assert state.current_step_order == 1
        assert state.completed is True

    def test_acknowledge_stops_escalation(self, project_context):
        user, tenant, project = project_context
        policy = EscalationPolicy.objects.create(
            tenant=tenant,
            project=project,
            name="Default",
            is_default=True,
            is_active=True,
        )
        EscalationStep.objects.create(
            policy=policy,
            order=1,
            delay_minutes=0,
            action=EscalationStep.Action.ASSIGN_USER,
            user=user,
        )
        incident = _create_incident(project_context)
        attach_escalation_policy(incident)

        acknowledge_incident(incident, user)

        stats = process_escalations()
        assert stats["escalated"] == 0
        state = IncidentEscalationState.objects.get(incident=incident)
        assert state.completed is True


@pytest.mark.django_db
class TestIncidentWorkflows:
    def test_incident_created_workflow_assigns_user(self, project_context):
        user, tenant, project = project_context
        IncidentWorkflowRule.objects.create(
            tenant=tenant,
            project=project,
            name="Auto-assign critical",
            trigger=IncidentWorkflowRule.Trigger.INCIDENT_CREATED,
            conditions={"severity_names": ["critical"]},
            actions=[{"type": "assign", "user_id": str(user.id)}],
            is_active=True,
        )
        incident = _create_incident(project_context)

        executed = run_workflow_rules(
            IncidentWorkflowRule.Trigger.INCIDENT_CREATED, incident
        )

        incident.refresh_from_db()
        assert executed == 1
        assert incident.assigned_to_id == user.id

    @patch("apps.incidents.services.escalation._notify_user")
    def test_unacknowledged_workflow_fires_after_delay(self, mock_notify, project_context):
        user, tenant, project = project_context
        IncidentWorkflowRule.objects.create(
            tenant=tenant,
            project=project,
            name="Nag on-call",
            trigger=IncidentWorkflowRule.Trigger.INCIDENT_UNACKNOWLEDGED,
            conditions={"delay_minutes": 5, "severity_names": ["critical"]},
            actions=[{"type": "notify_user", "user_id": str(user.id)}],
            is_active=True,
        )
        incident = _create_incident(project_context)
        Incident.objects.filter(pk=incident.pk).update(
            triggered_at=timezone.now() - timedelta(minutes=10)
        )
        incident.refresh_from_db()

        count = process_unacknowledged_workflows()

        assert count == 1
        mock_notify.assert_called_once_with(incident, user)

    def test_emit_incident_created_attaches_escalation(self, project_context):
        user, tenant, project = project_context
        policy = EscalationPolicy.objects.create(
            tenant=tenant,
            project=project,
            name="Default",
            is_default=True,
            is_active=True,
        )
        EscalationStep.objects.create(
            policy=policy,
            order=1,
            delay_minutes=15,
            action=EscalationStep.Action.NOTIFY_USER,
            user=user,
        )
        incident = _create_incident(project_context)

        with patch("apps.incidents.services.lifecycle._emit"):
            emit_incident_created(incident)

        assert IncidentEscalationState.objects.filter(incident=incident).exists()
