"""Tests for recurring maintenance scheduling."""
from datetime import timedelta

import pytest
from django.utils import timezone

from apps.accounts.services.onboarding import OnboardingService
from apps.maintenance.models import MaintenanceStatus, RecurrenceFrequency, ScheduledMaintenance
from apps.maintenance.services import schedule_next_occurrence


@pytest.fixture
def project_context(db):
    user, tenant, project = OnboardingService.create_account(
        email="recur@example.com",
        password="SecurePass123!",
        tenant_name="Recur Corp",
    )
    return tenant, project


@pytest.mark.django_db
class TestMaintenanceRecurrence:
    def test_daily_recurrence_creates_next_window(self, project_context):
        tenant, project = project_context
        now = timezone.now()
        maintenance = ScheduledMaintenance.objects.create(
            tenant=tenant,
            project=project,
            title="Nightly patch",
            starts_at=now - timedelta(hours=2),
            ends_at=now - timedelta(hours=1),
            status=MaintenanceStatus.COMPLETED,
            recurrence_frequency=RecurrenceFrequency.DAILY,
            recurrence_interval=1,
        )

        nxt = schedule_next_occurrence(maintenance)
        assert nxt is not None
        assert nxt.status == MaintenanceStatus.SCHEDULED
        assert nxt.starts_at > maintenance.starts_at
        assert nxt.series_id == maintenance.series_id

    def test_no_recurrence_returns_none(self, project_context):
        tenant, project = project_context
        now = timezone.now()
        maintenance = ScheduledMaintenance.objects.create(
            tenant=tenant,
            project=project,
            title="One-off",
            starts_at=now,
            ends_at=now + timedelta(hours=1),
            status=MaintenanceStatus.COMPLETED,
        )
        assert schedule_next_occurrence(maintenance) is None
