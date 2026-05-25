"""Auth flow tests."""
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.accounts.models import OtpPurpose
from apps.accounts.services.otp import OtpService

User = get_user_model()


@pytest.fixture
def api_client():
    return APIClient()


@pytest.mark.django_db
class TestActivationFlow:
    def test_register_then_activate(self, api_client):
        response = api_client.post('/api/v1/auth/register', {
            'email': 'newuser@example.com',
            'password': 'SecurePass123!',
            'tenant_name': 'Acme Corp',
            'first_name': 'New',
            'last_name': 'User',
        }, format='json')
        assert response.status_code == 201
        assert 'access' not in response.data

        user = User.objects.get(email='newuser@example.com')
        assert user.is_email_verified is False

        _, code = OtpService.create_challenge(user, OtpPurpose.ACTIVATION)
        activate = api_client.post('/api/v1/auth/activate', {
            'email': 'newuser@example.com',
            'code': code,
        }, format='json')
        assert activate.status_code == 200
        assert 'access' in activate.data
        user.refresh_from_db()
        assert user.is_email_verified is True
        assert user.is_active is True

    def test_activation_locked_then_resend(self, api_client):
        user = User.objects.create_user(
            email='locked@example.com',
            password='SecurePass123!',
        )
        _, code = OtpService.create_challenge(user, OtpPurpose.ACTIVATION)

        for _ in range(5):
            api_client.post('/api/v1/auth/activate', {
                'email': 'locked@example.com',
                'code': '000000',
            }, format='json')

        locked = api_client.post('/api/v1/auth/activate', {
            'email': 'locked@example.com',
            'code': code,
        }, format='json')
        assert locked.status_code == 429
        assert locked.data['code'] == 'otp_locked'
        assert locked.data['action'] == 'resend_activation'

        # Nouveau code (équivalent à POST /auth/resend-activation)
        _, new_code = OtpService.create_challenge(user, OtpPurpose.ACTIVATION)
        ok = api_client.post('/api/v1/auth/activate', {
            'email': 'locked@example.com',
            'code': new_code,
        }, format='json')
        assert ok.status_code == 200


@pytest.mark.django_db
class TestJwtEndpoints:
    def test_token_verify(self, api_client):
        user = User.objects.create_user(
            email='jwt@example.com',
            password='SecurePass123!',
            is_active=True,
            is_email_verified=True,
        )
        login = api_client.post('/api/v1/auth/login', {
            'email': 'jwt@example.com',
            'password': 'SecurePass123!',
        }, format='json')
        access = login.data['access']

        verify = api_client.post('/api/v1/auth/token/verify', {
            'token': access,
        }, format='json')
        assert verify.status_code == 200
