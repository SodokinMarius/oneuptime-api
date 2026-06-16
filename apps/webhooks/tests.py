"""Webhook event emission tests."""
from datetime import timedelta
from unittest.mock import patch

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.services.onboarding import OnboardingService
from apps.incidents.models import IncidentSeverity, IncidentState
from apps.monitoring.models import CheckStatus, Monitor, MonitorCheck, MonitorStatus
from apps.monitoring.services.runner import _open_incident, _update_monitor_status
from apps.rbac.services import bootstrap_project


@pytest.fixture
def project_context(db):
    user, tenant, project = OnboardingService.create_account(
        email="webhook@example.com",
        password="SecurePass123!",
        tenant_name="Webhook Corp",
    )
    user.is_active = True
    user.is_email_verified = True
    user.save()
    bootstrap_project(project, tenant)
    return user, tenant, project


@pytest.fixture
def monitor(project_context):
    _, tenant, project = project_context
    return Monitor.objects.create(
        tenant=tenant,
        project=project,
        name="API",
        type="api",
        url="https://example.com",
        retries=2,
        alert_on_failure=True,
    )


@pytest.mark.django_db
class TestIncidentCreatedWebhook:
    @patch("apps.incidents.services.WebhookService.emit")
    def test_auto_incident_emits_created(self, mock_emit, monitor):
        check = MonitorCheck.objects.create(
            tenant=monitor.tenant,
            monitor=monitor,
            checked_at=timezone.now(),
            status=CheckStatus.FAILURE,
            error_message="timeout",
        )
        _open_incident(monitor, check)
        mock_emit.assert_called_once()
        assert mock_emit.call_args.kwargs["event_type"] == "incident.created"

    @patch("apps.incidents.services.WebhookService.emit")
    def test_manual_incident_emits_created(self, mock_emit, project_context):
        user, tenant, project = project_context
        client = APIClient()
        client.force_authenticate(user=user)

        severity = IncidentSeverity.objects.get(project=project, name="critical")
        state = IncidentState.objects.get(project=project, name="triggered")

        response = client.post(
            "/api/v1/incidents/",
            {
                "title": "Manual incident",
                "description": "Test",
                "severity": str(severity.id),
                "state": str(state.id),
            },
            format="json",
            HTTP_X_TENANT_ID=str(tenant.id),
            HTTP_X_PROJECT_ID=str(project.id),
        )
        assert response.status_code == 201
        mock_emit.assert_called()
        assert any(
            c.kwargs.get("event_type") == "incident.created"
            for c in mock_emit.call_args_list
        )


@pytest.mark.django_db
class TestMonitorStatusChangedWebhook:
    @patch("apps.monitoring.services.webhooks.WebhookService.emit")
    def test_offline_transition_emits_status_changed(self, mock_emit, monitor):
        monitor.status = MonitorStatus.OPERATIONAL
        monitor.save(update_fields=["status"])

        for offset in (2, 1):
            MonitorCheck.objects.create(
                tenant=monitor.tenant,
                monitor=monitor,
                checked_at=timezone.now() - timedelta(seconds=offset),
                status=CheckStatus.FAILURE,
            )
        last = MonitorCheck.objects.filter(monitor=monitor).order_by("-checked_at").first()

        _update_monitor_status(monitor, last)

        mock_emit.assert_called_once()
        assert mock_emit.call_args.kwargs["event_type"] == "monitor.status_changed"
        payload = mock_emit.call_args.kwargs["payload"]
        assert payload["previous_status"] == MonitorStatus.OPERATIONAL
        assert payload["status"] == MonitorStatus.OFFLINE

    @patch("apps.monitoring.services.webhooks.WebhookService.emit")
    def test_no_emit_when_status_unchanged(self, mock_emit, monitor):
        check = MonitorCheck.objects.create(
            tenant=monitor.tenant,
            monitor=monitor,
            checked_at=timezone.now(),
            status=CheckStatus.SUCCESS,
        )
        _update_monitor_status(monitor, check)
        mock_emit.assert_not_called()
