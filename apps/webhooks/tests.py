"""Webhook event emission tests."""
from datetime import timedelta
from unittest.mock import MagicMock, patch

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.services.onboarding import OnboardingService
from apps.incidents.models import IncidentSeverity, IncidentState
from apps.monitoring.models import CheckStatus, Monitor, MonitorCheck, MonitorStatus
from apps.monitoring.services.runner import _open_incident, _update_monitor_status
from apps.rbac.services import bootstrap_project
from apps.webhooks.services import WebhookService


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


@pytest.mark.django_db
class TestDiscordPayloadFormat:
    def test_incident_embed(self):
        payload = WebhookService._format_discord_payload(
            "incident.created",
            {
                "incident": {
                    "title": "API down",
                    "severity": "critical",
                    "description": "Connection timeout",
                }
            },
        )
        embed = payload["embeds"][0]
        assert embed["title"] == "incident.created"
        assert "API down" in embed["description"]
        assert "critical" in embed["description"]
        assert "Connection timeout" in embed["description"]

    def test_monitor_status_embed(self):
        payload = WebhookService._format_discord_payload(
            "monitor.status_changed",
            {
                "monitor": {"name": "API", "status": "offline"},
                "previous_status": "operational",
                "status": "offline",
            },
        )
        embed = payload["embeds"][0]
        assert "API" in embed["description"]
        assert "operational" in embed["description"]
        assert "offline" in embed["description"]

    def test_maintenance_started_embed(self):
        payload = WebhookService._format_discord_payload(
            "scheduled_maintenance.started",
            {
                "scheduled_maintenance": {
                    "title": "DB upgrade",
                    "description": "PostgreSQL patch",
                    "starts_at": "2026-07-02T10:00:00Z",
                    "ends_at": "2026-07-02T12:00:00Z",
                    "status": "in_progress",
                }
            },
        )
        embed = payload["embeds"][0]
        assert embed["title"] == "scheduled_maintenance.started"
        assert "DB upgrade" in embed["description"]
        assert "PostgreSQL patch" in embed["description"]

    def test_maintenance_ended_embed(self):
        payload = WebhookService._format_discord_payload(
            "scheduled_maintenance.ended",
            {"scheduled_maintenance": {"title": "DB upgrade", "status": "completed"}},
        )
        embed = payload["embeds"][0]
        assert "DB upgrade" in embed["description"]

    @patch("apps.webhooks.services.http_requests.post")
    def test_discord_delivery_payload_accepted(self, mock_post, project_context):
        _, tenant, project = project_context
        from apps.webhooks.models import Webhook, WebhookDelivery, DeliveryStatus

        mock_post.return_value = MagicMock(status_code=204, text="")

        hook = Webhook.objects.create(
            tenant=tenant,
            project=project,
            name="Discord",
            url="https://discord.com/api/webhooks/123/token",
            secret="test_secret",
            payload_format="discord",
            event_types=["*"],
        )
        delivery = WebhookDelivery.objects.create(
            tenant=tenant,
            webhook=hook,
            event_id="evt_test",
            event_type="incident.created",
            payload=WebhookService._format_discord_payload(
                "incident.created",
                {"incident": {"title": "Test", "severity": "high"}},
            ),
            status=DeliveryStatus.PENDING,
        )

        result = WebhookService._deliver_one(delivery)
        assert result == "sent"
        body = mock_post.call_args.kwargs["data"]
        assert '"embeds"' in body
        assert '"content"' not in body or '"content":' not in body


@pytest.mark.django_db
class TestWebhookEventSubscription:
    def test_wildcard_prefix_matches_maintenance(self, project_context):
        _, tenant, project = project_context
        from apps.webhooks.models import Webhook

        Webhook.objects.create(
            tenant=tenant,
            project=project,
            name="Maint hook",
            url="https://example.com/hook",
            secret="secret",
            event_types=["scheduled_maintenance.*"],
        )
        hooks = WebhookService._subscribed_webhooks(
            tenant, project, "scheduled_maintenance.started"
        )
        assert len(hooks) == 1

    def test_star_matches_all_events(self, project_context):
        _, tenant, project = project_context
        from apps.webhooks.models import Webhook

        Webhook.objects.create(
            tenant=tenant,
            project=project,
            name="All events",
            url="https://example.com/hook",
            secret="secret",
            event_types=["*"],
        )
        assert len(WebhookService._subscribed_webhooks(tenant, project, "incident.created")) == 1
        assert len(WebhookService._subscribed_webhooks(tenant, project, "scheduled_maintenance.ended")) == 1

    def test_incident_only_does_not_match_maintenance(self, project_context):
        _, tenant, project = project_context
        from apps.webhooks.models import Webhook

        Webhook.objects.create(
            tenant=tenant,
            project=project,
            name="Incidents only",
            url="https://example.com/hook",
            secret="secret",
            event_types=["incident.created"],
        )
        assert WebhookService._subscribed_webhooks(tenant, project, "scheduled_maintenance.started") == []
