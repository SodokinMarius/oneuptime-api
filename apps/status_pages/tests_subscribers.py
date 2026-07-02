"""Tests for public status page subscriber signup and verification."""
from unittest.mock import patch

import pytest
from rest_framework.test import APIClient

from apps.accounts.services.onboarding import OnboardingService
from apps.status_pages.models import StatusPage, StatusPageSubscriber


@pytest.fixture
def public_status_page(db):
    _user, tenant, project = OnboardingService.create_account(
        email="status-owner@example.com",
        password="SecurePass123!",
        tenant_name="Status Corp",
    )
    page = StatusPage.objects.create(
        tenant=tenant,
        project=project,
        name="Public Status",
        slug="public-status",
        is_public=True,
    )
    return page


@pytest.fixture
def api_client():
    return APIClient()


@pytest.mark.django_db
class TestStatusPageSubscribe:
    @patch("apps.status_pages.services.notifications.SubscriberNotificationService.send_email_verification")
    def test_subscribe_with_email_sends_verification(self, mock_send, api_client, public_status_page):
        url = f"/api/v1/status/{public_status_page.slug}/subscribe/"
        response = api_client.post(url, {"email": "user@example.com"}, format="json")

        assert response.status_code == 201
        assert "email" in response.data["detail"].lower()
        mock_send.assert_called_once()
        sub = StatusPageSubscriber.objects.get(status_page=public_status_page, email="user@example.com")
        assert sub.is_verified is False
        assert sub.verification_token

    @patch("apps.status_pages.services.notifications.SubscriberNotificationService.send_phone_verification")
    @patch("apps.status_pages.services.notifications.SubscriberNotificationService.send_email_verification")
    def test_subscribe_with_phone_stores_and_verifies_sms(
        self, mock_email, mock_phone, api_client, public_status_page
    ):
        url = f"/api/v1/status/{public_status_page.slug}/subscribe/"
        response = api_client.post(
            url,
            {"email": "user@example.com", "phone": "+33612345678"},
            format="json",
        )

        assert response.status_code == 201
        mock_email.assert_called_once()
        mock_phone.assert_called_once()
        sub = StatusPageSubscriber.objects.get(email="user@example.com")
        assert sub.phone == "+33612345678"
        assert sub.phone_verified is False
        assert sub.phone_verification_token

    def test_subscribe_rejects_invalid_phone(self, api_client, public_status_page):
        url = f"/api/v1/status/{public_status_page.slug}/subscribe/"
        response = api_client.post(
            url,
            {"email": "user@example.com", "phone": "0612345678"},
            format="json",
        )
        assert response.status_code == 400

    @patch("apps.status_pages.services.notifications.SubscriberNotificationService.send_email_verification")
    def test_verify_email_marks_subscriber_verified(self, _mock_send, api_client, public_status_page):
        sub = StatusPageSubscriber.objects.create(
            tenant=public_status_page.tenant,
            status_page=public_status_page,
            email="user@example.com",
            verification_token="test-email-token",
            is_verified=False,
        )
        url = f"/api/v1/status/{public_status_page.slug}/verify-email/"
        response = api_client.post(url, {"token": "test-email-token"}, format="json")

        assert response.status_code == 200
        sub.refresh_from_db()
        assert sub.is_verified is True
        assert sub.verification_token == ""

    def test_verify_phone_marks_phone_verified(self, api_client, public_status_page):
        sub = StatusPageSubscriber.objects.create(
            tenant=public_status_page.tenant,
            status_page=public_status_page,
            email="user@example.com",
            phone="+33612345678",
            phone_verification_token="test-phone-token",
            phone_verified=False,
            is_verified=True,
        )
        url = f"/api/v1/status/{public_status_page.slug}/verify-phone/"
        response = api_client.post(url, {"token": "test-phone-token"}, format="json")

        assert response.status_code == 200
        sub.refresh_from_db()
        assert sub.phone_verified is True
        assert sub.phone_verification_token == ""
