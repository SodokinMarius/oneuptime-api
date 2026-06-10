"""Tests for SSO / SAML / SCIM."""
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.accounts.models import UserMembership
from apps.accounts.services.onboarding import OnboardingService
from apps.rbac.models import Role, Team, TeamMembership
from apps.sso.models import SSOConfig, SSOProvider
from apps.sso.services.enforcement import SSOEnforcement
from apps.sso.services.jit import JITProvisioner

User = get_user_model()


@pytest.fixture
def sso_setup(db):
    """Create tenant, project, admin user, and SSO config."""
    user, tenant, project = OnboardingService.create_account(
        email="admin@example.com",
        password="SecurePass123!",
        tenant_name="Acme Corp",
    )
    user.is_active = True
    user.is_email_verified = True
    user.save()

    admin_role = Role.objects.get(project=project, name="admin")
    admin_team = Team.objects.get(project=project, name="Administrators")

    config = SSOConfig.objects.create(
        tenant=tenant,
        project=project,
        provider=SSOProvider.OKTA,
        name="Okta SSO",
        entity_id="https://idp.example.com/entity",
        sso_url="https://idp.example.com/sso",
        x509_cert="MIIB...fake",
        default_role=admin_role,
        is_enabled=True,
    )
    config.default_teams.add(admin_team)
    return user, tenant, project, config


@pytest.mark.django_db
class TestSSOConfig:
    def test_create_sso_config(self, sso_setup):
        user, tenant, project, config = sso_setup
        assert config.scim_token
        assert config.project == project

    def test_regenerate_scim_token(self, sso_setup):
        _, _, _, config = sso_setup
        old = config.scim_token
        new = config.regenerate_scim_token()
        assert new != old
        config.refresh_from_db()
        assert config.scim_token == new


@pytest.mark.django_db
class TestSSOEnforcement:
    def test_enforce_sso_blocks_password_users(self, sso_setup):
        user, _, project, config = sso_setup
        config.enforce_sso = True
        config.save()
        assert SSOEnforcement.user_requires_sso_login(user) is True

    def test_enforce_sso_allows_when_disabled(self, sso_setup):
        user, _, _, config = sso_setup
        config.enforce_sso = False
        config.save()
        assert SSOEnforcement.user_requires_sso_login(user) is False


@pytest.mark.django_db
class TestJITProvisioner:
    def test_provision_new_user(self, sso_setup):
        _, tenant, project, config = sso_setup
        user = JITProvisioner.provision_from_saml(
            config, "newuser@example.com", "New", "User"
        )
        assert user.email == "newuser@example.com"
        assert user.is_email_verified
        assert UserMembership.objects.filter(user=user, tenant=tenant).exists()
        assert TeamMembership.objects.filter(user=user, team__project=project).exists()


@pytest.mark.django_db
class TestSCIMEndpoints:
    def test_scim_service_provider_config(self, sso_setup):
        _, _, _, config = sso_setup
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {config.scim_token}")
        response = client.get("/scim/v2/ServiceProviderConfig")
        assert response.status_code == 200
        assert "authenticationSchemes" in response.json()

    def test_scim_create_user(self, sso_setup):
        _, _, project, config = sso_setup
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {config.scim_token}")
        response = client.post(
            "/scim/v2/Users",
            {
                "schemas": ["urn:ietf:params:scim:schemas:core:2.0:User"],
                "userName": "scim-user@example.com",
                "name": {"givenName": "SCIM", "familyName": "User"},
                "active": True,
            },
            format="json",
        )
        assert response.status_code == 201
        data = response.json()
        assert data["userName"] == "scim-user@example.com"
        assert TeamMembership.objects.filter(
            user__email="scim-user@example.com", team__project=project
        ).exists()


@pytest.mark.django_db
class TestLoginEnforcement:
    def test_password_login_blocked_when_enforce_sso(self, sso_setup):
        user, _, _, config = sso_setup
        user.set_password("SecurePass123!")
        user.save()
        config.enforce_sso = True
        config.save()

        client = APIClient()
        response = client.post(
            "/api/v1/auth/login/",
            {"email": user.email, "password": "SecurePass123!"},
            format="json",
        )
        assert response.status_code == 403
        assert response.json()["sso_required"] is True
