"""Tests for maintenance subscriber notifications."""
from datetime import timedelta
from unittest.mock import patch

import pytest
from django.utils import timezone

from apps.accounts.services.onboarding import OnboardingService
from apps.maintenance.models import MaintenanceStatus, ScheduledMaintenance
from apps.maintenance.notifications import MaintenanceNotificationService
from apps.status_pages.models import StatusPage, StatusPageSubscriber


@pytest.fixture
def maintenance_with_sms_subscriber(db):
    _user, tenant, project = OnboardingService.create_account(
        email="notify@example.com",
        password="SecurePass123!",
        tenant_name="Notify Corp",
    )
    page = StatusPage.objects.create(
        tenant=tenant,
        project=project,
        name="Public",
        slug="public",
        is_public=True,
    )
    now = timezone.now()
    maintenance = ScheduledMaintenance.objects.create(
        tenant=tenant,
        project=project,
        title="DB upgrade",
        description="Planned work",
        starts_at=now - timedelta(minutes=5),
        ends_at=now + timedelta(minutes=55),
        status=MaintenanceStatus.IN_PROGRESS,
        notify_subscribers=True,
    )
    StatusPageSubscriber.objects.create(
        tenant=tenant,
        status_page=page,
        email="sms-only@example.com",
        phone="+33612345678",
        is_verified=False,
        phone_verified=True,
    )
    return maintenance


@pytest.mark.django_db
class TestMaintenanceNotifications:
    @patch("core.notifications.sms.SMSService.send")
    def test_sms_only_subscriber_does_not_crash(self, mock_send, maintenance_with_sms_subscriber):
        MaintenanceNotificationService.notify_started(maintenance_with_sms_subscriber)

        mock_send.assert_called_once()
        message = mock_send.call_args[0][1]
        assert "DB upgrade" in message
        assert "Maintenance en cours" in message

    @patch("core.notifications.sms.SMSService.send")
    def test_notify_ended_sends_sms_without_email_subscribers(self, mock_send, maintenance_with_sms_subscriber):
        MaintenanceNotificationService.notify_ended(maintenance_with_sms_subscriber)

        mock_send.assert_called_once()
        message = mock_send.call_args[0][1]
        assert "Maintenance terminée" in message
