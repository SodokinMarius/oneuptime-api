"""
JIT (Just-In-Time) user provisioning after SAML login or SCIM create.
"""
from __future__ import annotations

import secrets

from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone

from apps.accounts.models import UserMembership
from apps.rbac.models import Team, TeamMembership

User = get_user_model()


class JITProvisioner:
    """Create or update users and project memberships from SSO/SCIM."""

    @staticmethod
    @transaction.atomic
    def provision_from_saml(
        sso_config,
        email: str,
        first_name: str = "",
        last_name: str = "",
    ) -> User:
        """
        Ensure user exists and has tenant + project team memberships.

        Raises ValueError if JIT is disabled and user does not exist,
        or if no default teams/role are configured for new users.
        """
        tenant = sso_config.tenant
        project = sso_config.project

        user = User.objects.filter(email__iexact=email).first()
        created = False

        if user is None:
            if not sso_config.jit_enabled:
                raise ValueError("User not found and JIT provisioning is disabled")
            user = User.objects.create_user(
                email=email,
                password=secrets.token_urlsafe(32),
                first_name=first_name,
                last_name=last_name,
                is_active=True,
                is_email_verified=True,
            )
            created = True
        else:
            updates = []
            if first_name and not user.first_name:
                user.first_name = first_name
                updates.append("first_name")
            if last_name and not user.last_name:
                user.last_name = last_name
                updates.append("last_name")
            if not user.is_email_verified:
                user.is_email_verified = True
                updates.append("is_email_verified")
            if not user.is_active:
                user.is_active = True
                updates.append("is_active")
            if updates:
                user.save(update_fields=updates)

        # Tenant membership
        UserMembership.objects.get_or_create(
            user=user,
            tenant=tenant,
            defaults={
                "is_owner": False,
                "accepted_at": timezone.now(),
            },
        )

        # Project team memberships
        has_project_access = TeamMembership.objects.filter(
            user=user, team__project=project
        ).exists()

        if not has_project_access:
            teams = list(sso_config.default_teams.all())
            role = sso_config.default_role
            if not teams or role is None:
                raise ValueError(
                    "No project access for user. Configure default_teams and default_role on SSO config."
                )
            for team in teams:
                TeamMembership.objects.get_or_create(
                    team=team,
                    user=user,
                    defaults={"role": role},
                )

        return user

    @staticmethod
    @transaction.atomic
    def provision_from_scim(
        sso_config,
        email: str,
        first_name: str = "",
        last_name: str = "",
        teams: list | None = None,
    ) -> tuple[User, bool]:
        """Provision user via SCIM. Returns (user, created)."""
        if not sso_config.scim_auto_provision:
            user = User.objects.filter(email__iexact=email).first()
            if not user:
                raise ValueError("User not found and SCIM auto-provision is disabled")
            return user, False

        tenant = sso_config.tenant
        project = sso_config.project
        user = User.objects.filter(email__iexact=email).first()
        created = False

        if user is None:
            user = User.objects.create_user(
                email=email,
                password=secrets.token_urlsafe(32),
                first_name=first_name,
                last_name=last_name,
                is_active=True,
                is_email_verified=True,
            )
            created = True

        UserMembership.objects.get_or_create(
            user=user,
            tenant=tenant,
            defaults={"is_owner": False, "accepted_at": timezone.now()},
        )

        target_teams = teams
        if target_teams is None:
            if sso_config.scim_enable_push_groups:
                target_teams = [_get_or_create_unassigned_team(tenant, project)]
            else:
                target_teams = list(sso_config.default_teams.all())

        role = sso_config.default_role
        if not target_teams or role is None:
            raise ValueError("SCIM provisioning requires default_teams and default_role")

        for team in target_teams:
            TeamMembership.objects.get_or_create(
                team=team,
                user=user,
                defaults={"role": role},
            )

        return user, created

    @staticmethod
    @transaction.atomic
    def deprovision_from_scim(sso_config, user: User) -> None:
        """Remove user from SCIM-managed teams (does not delete the user)."""
        if not sso_config.scim_auto_deprovision:
            return
        if sso_config.scim_enable_push_groups:
            return

        team_ids = sso_config.default_teams.values_list("id", flat=True)
        TeamMembership.objects.filter(
            user=user,
            team_id__in=team_ids,
            team__project=sso_config.project,
        ).delete()


def _get_or_create_unassigned_team(tenant, project) -> Team:
    team, _ = Team.objects.get_or_create(
        project=project,
        name="Unassigned",
        defaults={
            "tenant": tenant,
            "description": "SCIM users awaiting group assignment",
        },
    )
    return team
