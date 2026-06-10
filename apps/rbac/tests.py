"""RBAC permission resolution and enforcement tests."""
import hashlib

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient, APIRequestFactory

from apps.accounts.services.onboarding import OnboardingService
from apps.monitoring.models import Monitor
from apps.rbac.models import ApiKey, ResourcePolicy, Role, Team, TeamMembership
from apps.rbac.permissions import (
    RequirePermission,
    check_resource_policy,
    has_permission,
)
from core.team_scoping import apply_team_scope

User = get_user_model()


@pytest.fixture
def project_context(db):
    """Founder + tenant + project with bootstrapped roles."""
    user, tenant, project = OnboardingService.create_account(
        email="founder@example.com",
        password="SecurePass123!",
        tenant_name="RBAC Corp",
    )
    user.is_active = True
    user.is_email_verified = True
    user.save()
    return user, tenant, project


@pytest.fixture
def member_user(project_context):
    """Second user with member role on the default project."""
    founder, tenant, project = project_context
    member = User.objects.create_user(
        email="member@example.com",
        password="SecurePass123!",
        is_active=True,
        is_email_verified=True,
    )
    member_role = Role.objects.get(project=project, name="member")
    team = Team.objects.get(project=project, name="Administrators")
    TeamMembership.objects.create(team=team, user=member, role=member_role, granted_by=founder)
    return member, project


@pytest.mark.django_db
class TestHasPermission:
    def test_wildcard_star(self):
        assert has_permission({"*"}, "monitor:delete") is True

    def test_resource_wildcard(self):
        assert has_permission({"monitor:*"}, "monitor:pause") is True
        assert has_permission({"monitor:*"}, "incident:read") is False

    def test_action_wildcard(self):
        assert has_permission({"*:read"}, "monitor:read") is True
        assert has_permission({"*:read"}, "monitor:delete") is False


@pytest.mark.django_db
class TestResourcePolicy:
    def test_deny_blocks_even_with_role_wildcard(self, project_context):
        founder, _, project = project_context
        admin_role = Role.objects.get(project=project, name="admin")

        ResourcePolicy.objects.create(
            tenant=project.tenant,
            project=project,
            role=admin_role,
            resource_type="monitor",
            resource_id=None,
            effect=ResourcePolicy.EFFECT_DENY,
        )

        result = check_resource_policy(founder, project, "monitor", None)
        assert result == "deny"

    def test_allow_without_role_permission(self, member_user):
        member, project = member_user
        member_role = Role.objects.get(project=project, name="member")

        ResourcePolicy.objects.create(
            tenant=project.tenant,
            project=project,
            role=member_role,
            resource_type="status_page",
            resource_id=None,
            effect=ResourcePolicy.EFFECT_ALLOW,
        )

        result = check_resource_policy(member, project, "status_page", None)
        assert result == "allow"

    def test_type_level_ignores_specific_resource_policies(self, member_user):
        """List actions only evaluate type-wide (resource_id=NULL) policies."""
        from apps.monitoring.models import Monitor

        member, project = member_user
        member_role = Role.objects.get(project=project, name="member")
        monitor = Monitor.objects.create(
            tenant=project.tenant,
            project=project,
            name="API",
            type="api",
            url="https://example.com",
        )

        ResourcePolicy.objects.create(
            tenant=project.tenant,
            project=project,
            role=member_role,
            resource_type="monitor",
            resource_id=monitor.id,
            effect=ResourcePolicy.EFFECT_DENY,
        )

        # Type-level check (list) — specific deny should not apply
        assert check_resource_policy(member, project, "monitor", None) is None
        # Object-level check — specific deny applies
        assert check_resource_policy(member, project, "monitor", monitor.id) == "deny"


@pytest.mark.django_db
class TestRequirePermission:
    def _request(self, user, project, api_key=None):
        factory = APIRequestFactory()
        request = factory.get("/")
        request.user = user
        request.project = project
        if api_key:
            request.api_key = api_key
        return request

    def test_resource_policy_deny_overrides_admin_role(self, project_context):
        founder, _, project = project_context
        admin_role = Role.objects.get(project=project, name="admin")
        ResourcePolicy.objects.create(
            tenant=project.tenant,
            project=project,
            role=admin_role,
            resource_type="monitor",
            effect=ResourcePolicy.EFFECT_DENY,
        )

        perm = RequirePermission("monitor:read")
        assert perm.has_permission(self._request(founder, project), None) is False

    def test_resource_policy_allow_grants_without_role_perm(self, member_user):
        member, project = member_user
        member_role = Role.objects.get(project=project, name="member")
        # member role has no status_page:delete
        ResourcePolicy.objects.create(
            tenant=project.tenant,
            project=project,
            role=member_role,
            resource_type="status_page",
            effect=ResourcePolicy.EFFECT_ALLOW,
        )

        perm = RequirePermission("status_page:delete")
        assert perm.has_permission(self._request(member, project), None) is True

    def test_api_key_permissions_enforced(self, project_context):
        founder, tenant, project = project_context
        _, raw_key = ApiKey.create_key(
            tenant=tenant,
            project=project,
            name="limited",
            permissions=["monitor:read"],
            created_by=founder,
        )
        api_key = ApiKey.objects.get(key_hash=hashlib.sha256(raw_key.encode()).hexdigest())

        read_perm = RequirePermission("monitor:read")
        delete_perm = RequirePermission("monitor:delete")

        req = self._request(founder, project, api_key=api_key)
        assert read_perm.has_permission(req, None) is True
        assert delete_perm.has_permission(req, None) is False

    def test_api_key_bypasses_resource_policy_deny(self, project_context):
        """API keys use their own permission list, not ResourcePolicy."""
        founder, tenant, project = project_context
        admin_role = Role.objects.get(project=project, name="admin")
        ResourcePolicy.objects.create(
            tenant=project.tenant,
            project=project,
            role=admin_role,
            resource_type="monitor",
            effect=ResourcePolicy.EFFECT_DENY,
        )
        _, raw_key = ApiKey.create_key(
            tenant=tenant,
            project=project,
            name="ci",
            permissions=["monitor:read"],
            created_by=founder,
        )
        api_key = ApiKey.objects.get(key_hash=hashlib.sha256(raw_key.encode()).hexdigest())

        perm = RequirePermission("monitor:read")
        assert perm.has_permission(self._request(founder, project, api_key=api_key), None) is True


@pytest.mark.django_db
class TestAuditPermissionNames:
    """Member role uses audit_log:* — views must match constants."""

    def test_member_can_list_audit_log(self, member_user):
        member, project = member_user
        client = APIClient()
        client.force_authenticate(user=member)
        client.credentials(
            HTTP_X_TENANT_ID=str(project.tenant_id),
            HTTP_X_PROJECT_ID=str(project.id),
        )
        response = client.get("/api/v1/audit-log/")
        assert response.status_code == 200

    def test_member_cannot_manage_retention(self, member_user):
        member, project = member_user
        client = APIClient()
        client.force_authenticate(user=member)
        client.credentials(
            HTTP_X_TENANT_ID=str(project.tenant_id),
            HTTP_X_PROJECT_ID=str(project.id),
        )
        response = client.post(
            "/api/v1/retention-policies/",
            {"data_type": "audit_logs", "retention_days": 90},
            format="json",
        )
        assert response.status_code == 403


@pytest.mark.django_db
class TestUserRBAC:
    def test_member_cannot_invite_without_permission(self, member_user):
        member, project = member_user
        client = APIClient()
        client.force_authenticate(user=member)
        client.credentials(
            HTTP_X_TENANT_ID=str(project.tenant_id),
            HTTP_X_PROJECT_ID=str(project.id),
        )
        response = client.post(
            "/api/v1/users/invite/",
            {"email": "new@example.com"},
            format="json",
        )
        assert response.status_code == 403

    def test_admin_can_invite(self, project_context):
        founder, tenant, project = project_context
        client = APIClient()
        client.force_authenticate(user=founder)
        client.credentials(
            HTTP_X_TENANT_ID=str(tenant.id),
            HTTP_X_PROJECT_ID=str(project.id),
        )
        response = client.post(
            "/api/v1/users/invite/",
            {"email": "invited@example.com"},
            format="json",
        )
        assert response.status_code in (201, 409)  # 409 if duplicate


@pytest.fixture
def two_team_setup(project_context, member_user):
    """Founder (admin) + member in a separate team only."""
    founder, tenant, project = project_context
    member, _ = member_user

    team_admin = Team.objects.get(project=project, name="Administrators")
    team_platform = Team.objects.create(
        tenant=tenant, project=project, name="Platform"
    )

    TeamMembership.objects.filter(user=member).delete()
    member_role = Role.objects.get(project=project, name="member")
    TeamMembership.objects.create(
        team=team_platform, user=member, role=member_role, granted_by=founder
    )

    return founder, member, project, tenant, team_admin, team_platform


def _api_client(user, tenant, project):
    client = APIClient()
    client.force_authenticate(user=user)
    client.credentials(
        HTTP_X_TENANT_ID=str(tenant.id),
        HTTP_X_PROJECT_ID=str(project.id),
    )
    return client


def _list_results(response):
    data = response.json()
    if isinstance(data, dict) and "results" in data:
        return data["results"]
    return data


@pytest.mark.django_db
class TestTeamScoping:
    def test_shared_resources_visible_to_all_members(self, two_team_setup):
        founder, member, project, tenant, team_admin, _ = two_team_setup
        Monitor.objects.create(
            tenant=tenant,
            project=project,
            name="Shared API",
            url="https://example.com/health",
            team=None,
        )

        qs = Monitor.objects.filter(project=project)
        member_ids = set(
            apply_team_scope(qs, member, project).values_list("id", flat=True)
        )
        assert len(member_ids) == 1

    def test_team_scoped_resource_hidden_from_other_team(self, two_team_setup):
        founder, member, project, tenant, team_admin, team_platform = two_team_setup
        Monitor.objects.create(
            tenant=tenant,
            project=project,
            name="Admin only",
            url="https://admin.example.com",
            team=team_admin,
        )
        Monitor.objects.create(
            tenant=tenant,
            project=project,
            name="Platform API",
            url="https://platform.example.com",
            team=team_platform,
        )

        visible = apply_team_scope(
            Monitor.objects.filter(project=project), member, project
        )
        names = set(visible.values_list("name", flat=True))
        assert names == {"Platform API"}

    def test_admin_bypasses_team_filter(self, two_team_setup):
        founder, member, project, tenant, team_admin, team_platform = two_team_setup
        Monitor.objects.create(
            tenant=tenant,
            project=project,
            name="Admin only",
            url="https://admin.example.com",
            team=team_admin,
        )

        visible = apply_team_scope(
            Monitor.objects.filter(project=project), founder, project
        )
        assert visible.count() == 1

    def test_list_monitors_respects_team_scope(self, two_team_setup):
        founder, member, project, tenant, team_admin, team_platform = two_team_setup
        Monitor.objects.create(
            tenant=tenant,
            project=project,
            name="Admin only",
            url="https://admin.example.com",
            team=team_admin,
        )
        Monitor.objects.create(
            tenant=tenant,
            project=project,
            name="Platform API",
            url="https://platform.example.com",
            team=team_platform,
        )

        client = _api_client(member, tenant, project)
        response = client.get("/api/v1/monitors/")
        assert response.status_code == 200
        names = {m["name"] for m in _list_results(response)}
        assert names == {"Platform API"}

    def test_create_monitor_defaults_to_user_team(self, two_team_setup):
        founder, member, project, tenant, _, team_platform = two_team_setup
        client = _api_client(member, tenant, project)
        response = client.post(
            "/api/v1/monitors/",
            {"name": "New monitor", "type": "api", "url": "https://new.example.com"},
            format="json",
        )
        assert response.status_code == 201
        data = response.json()
        assert data["team_id"] == str(team_platform.id)
        assert data["team_name"] == "Platform"

    def test_admin_can_create_shared_monitor(self, project_context):
        founder, tenant, project = project_context
        client = _api_client(founder, tenant, project)
        response = client.post(
            "/api/v1/monitors/",
            {
                "name": "Shared monitor",
                "type": "api",
                "url": "https://shared.example.com",
                "team_id": None,
            },
            format="json",
        )
        assert response.status_code == 201
        assert response.json()["team_id"] is None

    def test_team_id_query_param_filters_list(self, two_team_setup):
        founder, member, project, tenant, team_admin, team_platform = two_team_setup
        Monitor.objects.create(
            tenant=tenant,
            project=project,
            name="Shared",
            url="https://shared.example.com",
            team=None,
        )
        Monitor.objects.create(
            tenant=tenant,
            project=project,
            name="Platform API",
            url="https://platform.example.com",
            team=team_platform,
        )

        client = _api_client(member, tenant, project)
        response = client.get(f"/api/v1/monitors/?team_id={team_platform.id}")
        assert response.status_code == 200
        names = {m["name"] for m in _list_results(response)}
        assert names == {"Platform API"}
