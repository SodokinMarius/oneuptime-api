"""Maintenance window rules — alert suppression, status page, post-maintenance re-evaluation."""
from datetime import timedelta
from unittest.mock import patch

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.services.onboarding import OnboardingService
from apps.maintenance.models import MaintenanceStatus, ScheduledMaintenance
from apps.maintenance.services import (
    handle_maintenance_ended,
    is_monitor_under_maintenance,
    visible_maintenances_for_status_page,
)
from apps.monitoring.models import CheckStatus, Monitor, MonitorCheck, MonitorStatus
from apps.monitoring.services.runner import _update_monitor_status, reevaluate_monitor_incident
from apps.rbac.services import bootstrap_project
from apps.status_pages.models import StatusPage, StatusPageResource
from apps.status_pages.serializers import StatusPagePublicSerializer


@pytest.fixture
def project_context(db):
    user, tenant, project = OnboardingService.create_account(
        email="maint@example.com",
        password="SecurePass123!",
        tenant_name="Maint Corp",
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
        name="Payment API",
        type="api",
        url="https://example.com/health",
        retries=2,
        alert_on_failure=True,
    )


def _failure_check(monitor, *, offset_seconds=0):
    return MonitorCheck.objects.create(
        tenant=monitor.tenant,
        monitor=monitor,
        checked_at=timezone.now() - timedelta(seconds=offset_seconds),
        status=CheckStatus.FAILURE,
        error_message="down",
    )


def _in_progress_maintenance(project, monitor, **kwargs):
    now = timezone.now()
    mw = ScheduledMaintenance.objects.create(
        tenant=project.tenant,
        project=project,
        title=kwargs.get("title", "DB upgrade"),
        description=kwargs.get("description", "Planned work"),
        starts_at=now - timedelta(minutes=5),
        ends_at=now + timedelta(minutes=55),
        status=MaintenanceStatus.IN_PROGRESS,
        is_visible_on_status_page=kwargs.get("is_visible_on_status_page", True),
        notify_subscribers=kwargs.get("notify_subscribers", True),
    )
    if monitor is not False:
        targets = monitor if isinstance(monitor, (list, tuple)) else [monitor]
        mw.monitors.set([m for m in targets if m is not None])
    return mw


@pytest.mark.django_db
class TestAlertSuppression:
    def test_no_incident_while_monitor_under_maintenance(self, monitor):
        _in_progress_maintenance(monitor.project, monitor)
        check1 = _failure_check(monitor, offset_seconds=2)
        check2 = _failure_check(monitor, offset_seconds=1)

        _update_monitor_status(monitor, check2)

        monitor.refresh_from_db()
        assert monitor.status == MonitorStatus.OPERATIONAL
        assert monitor.current_incident_id is None
        assert check2.triggered_incident_id is None

    def test_incident_opened_when_not_under_maintenance(self, monitor):
        check1 = _failure_check(monitor, offset_seconds=2)
        check2 = _failure_check(monitor, offset_seconds=1)

        _update_monitor_status(monitor, check2)

        monitor.refresh_from_db()
        assert monitor.status == MonitorStatus.OFFLINE
        assert monitor.current_incident_id is not None

    def test_project_wide_maintenance_covers_all_monitors(self, project_context, monitor):
        _, _, project = project_context
        other = Monitor.objects.create(
            tenant=project.tenant,
            project=project,
            name="Other API",
            type="api",
            url="https://example.com/other",
        )
        _in_progress_maintenance(project, False)

        assert is_monitor_under_maintenance(monitor) is True
        assert is_monitor_under_maintenance(other) is True


@pytest.mark.django_db
class TestPostMaintenanceReevaluation:
    def test_opens_incident_after_maintenance_if_still_failing(self, monitor):
        _failure_check(monitor, offset_seconds=3)
        _failure_check(monitor, offset_seconds=1)

        reevaluate_monitor_incident(monitor)

        monitor.refresh_from_db()
        assert monitor.status == MonitorStatus.OFFLINE
        assert monitor.current_incident_id is not None

    def test_handle_maintenance_ended_triggers_reevaluation(self, monitor):
        mw = _in_progress_maintenance(monitor.project, monitor)
        _failure_check(monitor, offset_seconds=3)
        _failure_check(monitor, offset_seconds=1)

        mw.status = MaintenanceStatus.COMPLETED
        mw.save(update_fields=["status"])

        with patch("apps.maintenance.notifications.MaintenanceNotificationService.notify_ended"):
            handle_maintenance_ended(mw)

        monitor.refresh_from_db()
        assert monitor.status == MonitorStatus.OFFLINE
        assert monitor.current_incident_id is not None


@pytest.mark.django_db
class TestStatusPageIntegration:
    def test_public_page_exposes_maintenance_and_display_status(self, monitor):
        page = StatusPage.objects.create(
            tenant=monitor.tenant,
            project=monitor.project,
            name="Public",
            slug="public-status",
            is_public=True,
        )
        StatusPageResource.objects.create(
            tenant=monitor.tenant,
            status_page=page,
            monitor=monitor,
            order=0,
        )
        _in_progress_maintenance(monitor.project, monitor, title="Scheduled DB work")

        data = StatusPagePublicSerializer(page).data
        assert len(data["scheduled_maintenances"]) == 1
        assert data["scheduled_maintenances"][0]["title"] == "Scheduled DB work"
        assert data["resources"][0]["display_status"] == "maintenance"
        assert data["resources"][0]["monitor_status"] == "operational"

    def test_hidden_maintenance_not_on_public_page(self, monitor):
        page = StatusPage.objects.create(
            tenant=monitor.tenant,
            project=monitor.project,
            name="Public",
            slug="hidden-maint",
            is_public=True,
        )
        StatusPageResource.objects.create(
            tenant=monitor.tenant,
            status_page=page,
            monitor=monitor,
        )
        _in_progress_maintenance(
            monitor.project,
            monitor,
            is_visible_on_status_page=False,
        )

        assert visible_maintenances_for_status_page(page).count() == 0


@pytest.mark.django_db
class TestMaintenanceCreatedWebhook:
    def test_create_emits_scheduled_maintenance_created(self, project_context):
        user, tenant, project = project_context
        client = APIClient()
        client.force_authenticate(user=user)

        now = timezone.now()
        with patch("apps.maintenance.services.emit_maintenance_webhook") as emit:
            response = client.post(
                "/api/v1/scheduled-maintenance/",
                {
                    "title": "Patch Tuesday",
                    "description": "OS updates",
                    "starts_at": (now + timedelta(hours=1)).isoformat(),
                    "ends_at": (now + timedelta(hours=2)).isoformat(),
                    "monitors": [],
                },
                format="json",
                HTTP_X_TENANT_ID=str(tenant.id),
                HTTP_X_PROJECT_ID=str(project.id),
            )

        assert response.status_code == 201
        emit.assert_called_once()
        assert emit.call_args[0][0] == "scheduled_maintenance.created"
