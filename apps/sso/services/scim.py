"""
SCIM 2.0 provisioning helpers — Users and Groups (Teams).
"""
from __future__ import annotations

from django.contrib.auth import get_user_model

from apps.rbac.models import Team, TeamMembership
from apps.sso.models import SCIMOperation, SCIMResource, SCIMSyncLog
from apps.sso.services.jit import JITProvisioner, _get_or_create_unassigned_team

User = get_user_model()

SCIM_SCHEMA_USER = "urn:ietf:params:scim:schemas:core:2.0:User"
SCIM_SCHEMA_GROUP = "urn:ietf:params:scim:schemas:core:2.0:Group"
SCIM_LIST_SCHEMA = "urn:ietf:params:scim:api:messages:2.0:ListResponse"


class SCIMService:
    def __init__(self, sso_config):
        self.config = sso_config
        self.project = sso_config.project
        self.tenant = sso_config.tenant

    def _log(self, operation, resource, external_id, payload=None, status="success", error=""):
        SCIMSyncLog.objects.create(
            config=self.config,
            operation=operation,
            resource=resource,
            external_id=external_id,
            payload=payload,
            status=status,
            error_message=error,
        )

    def _project_users(self):
        user_ids = TeamMembership.objects.filter(
            team__project=self.project
        ).values_list("user_id", flat=True).distinct()
        return User.objects.filter(id__in=user_ids, is_erased=False)

    def user_to_scim(self, user: User) -> dict:
        return {
            "schemas": [SCIM_SCHEMA_USER],
            "id": str(user.id),
            "externalId": user.email,
            "userName": user.email,
            "name": {
                "givenName": user.first_name,
                "familyName": user.last_name,
                "formatted": user.full_name,
            },
            "displayName": user.full_name,
            "emails": [{"value": user.email, "primary": True}],
            "active": user.is_active,
            "meta": {
                "resourceType": "User",
                "created": user.created_at.isoformat(),
            },
        }

    def team_to_scim(self, team: Team, include_members: bool = False) -> dict:
        data = {
            "schemas": [SCIM_SCHEMA_GROUP],
            "id": str(team.id),
            "displayName": team.name,
            "meta": {
                "resourceType": "Group",
                "created": team.created_at.isoformat(),
            },
        }
        if include_members:
            memberships = TeamMembership.objects.filter(team=team).select_related("user")
            data["members"] = [
                {"value": str(m.user.id), "display": m.user.email}
                for m in memberships
            ]
        return data

    def list_users(self, filter_expr: str | None = None) -> list[dict]:
        qs = self._project_users()
        if filter_expr:
            email = _parse_filter_email(filter_expr)
            if email:
                qs = qs.filter(email__iexact=email)
                if not qs.exists() and self.config.scim_auto_provision:
                    user, _ = JITProvisioner.provision_from_scim(self.config, email)
                    return [self.user_to_scim(user)]
        return [self.user_to_scim(u) for u in qs.order_by("email")]

    def get_user(self, user_id: str) -> dict | None:
        user = self._project_users().filter(id=user_id).first()
        return self.user_to_scim(user) if user else None

    def create_user(self, body: dict) -> dict:
        email = _extract_email(body)
        first_name, last_name = _extract_name(body)
        try:
            user, created = JITProvisioner.provision_from_scim(
                self.config, email, first_name, last_name
            )
            self._log(
                SCIMOperation.CREATE if created else SCIMOperation.UPDATE,
                SCIMResource.USER,
                email,
                body,
            )
            return self.user_to_scim(user)
        except ValueError as exc:
            self._log(SCIMOperation.CREATE, SCIMResource.USER, email, body, "error", str(exc))
            raise

    def update_user(self, user_id: str, body: dict) -> dict | None:
        user = User.objects.filter(id=user_id).first()
        if not user:
            return None

        email = body.get("userName") or _extract_email(body, required=False)
        if email and email != user.email:
            user.email = email.lower()
        name = body.get("name") or {}
        if name.get("givenName"):
            user.first_name = name["givenName"]
        if name.get("familyName"):
            user.last_name = name["familyName"]
        active = body.get("active")
        if active is not None and not self.config.scim_enable_push_groups:
            if not active:
                JITProvisioner.deprovision_from_scim(self.config, user)
            user.is_active = bool(active)
        user.save()

        self._log(SCIMOperation.UPDATE, SCIMResource.USER, str(user.id), body)
        return self.user_to_scim(user)

    def delete_user(self, user_id: str) -> bool:
        user = User.objects.filter(id=user_id).first()
        if not user:
            return False
        JITProvisioner.deprovision_from_scim(self.config, user)
        self._log(SCIMOperation.DELETE, SCIMResource.USER, str(user.id))
        return True

    def list_groups(self, filter_expr: str | None = None) -> list[dict]:
        qs = Team.objects.filter(project=self.project)
        if filter_expr:
            name = _parse_filter_display_name(filter_expr)
            if name:
                qs = qs.filter(name=name)
        return [self.team_to_scim(t) for t in qs.order_by("name")]

    def get_group(self, group_id: str) -> dict | None:
        team = Team.objects.filter(id=group_id, project=self.project).first()
        return self.team_to_scim(team, include_members=True) if team else None

    def create_group(self, body: dict) -> dict:
        name = body.get("displayName", "").strip()
        if not name:
            raise ValueError("displayName is required")
        team, _ = Team.objects.get_or_create(
            project=self.project,
            name=name,
            defaults={"tenant": self.tenant, "description": "SCIM-provisioned group"},
        )
        _sync_group_members(self.config, team, body.get("members") or [])
        self._log(SCIMOperation.CREATE, SCIMResource.GROUP, name, body)
        return self.team_to_scim(team, include_members=True)

    def replace_group(self, group_id: str, body: dict) -> dict | None:
        team = Team.objects.filter(id=group_id, project=self.project).first()
        if not team:
            return None
        if body.get("displayName"):
            team.name = body["displayName"]
            team.save(update_fields=["name", "updated_at"])
        TeamMembership.objects.filter(team=team).delete()
        _sync_group_members(self.config, team, body.get("members") or [])
        self._log(SCIMOperation.UPDATE, SCIMResource.GROUP, str(team.id), body)
        return self.team_to_scim(team, include_members=True)

    def patch_group(self, group_id: str, operations: list) -> dict | None:
        team = Team.objects.filter(id=group_id, project=self.project).first()
        if not team:
            return None
        for op in operations:
            action = (op.get("op") or "").lower()
            path = (op.get("path") or "").lower()
            value = op.get("value")
            if path == "displayname" and action in ("replace", "add"):
                team.name = value
                team.save(update_fields=["name", "updated_at"])
            elif path == "members" or path.startswith("members"):
                if action == "add":
                    _sync_group_members(self.config, team, value if isinstance(value, list) else [value])
                elif action == "remove":
                    ids = _member_ids(value)
                    TeamMembership.objects.filter(team=team, user_id__in=ids).delete()
                elif action == "replace":
                    TeamMembership.objects.filter(team=team).delete()
                    _sync_group_members(self.config, team, value if isinstance(value, list) else [])
        self._log(SCIMOperation.UPDATE, SCIMResource.GROUP, str(team.id), {"operations": operations})
        return self.team_to_scim(team, include_members=True)

    def delete_group(self, group_id: str) -> bool:
        team = Team.objects.filter(id=group_id, project=self.project).first()
        if not team or team.name == "Unassigned":
            return False
        TeamMembership.objects.filter(team=team).delete()
        team.delete()
        self._log(SCIMOperation.DELETE, SCIMResource.GROUP, group_id)
        return True


def _extract_email(body: dict, required: bool = True) -> str:
    email = body.get("userName") or ""
    if not email:
        emails = body.get("emails") or []
        if emails:
            email = emails[0].get("value", "")
    email = email.strip().lower()
    if required and (not email or "@" not in email):
        raise ValueError("userName or emails[0].value is required")
    return email


def _extract_name(body: dict) -> tuple[str, str]:
    name = body.get("name") or {}
    first = name.get("givenName", "")
    last = name.get("familyName", "")
    if not first and not last:
        display = body.get("displayName", "")
        if display:
            parts = display.split(" ", 1)
            first = parts[0]
            last = parts[1] if len(parts) > 1 else ""
    return first, last


def _parse_filter_email(filter_expr: str) -> str | None:
    # userName eq "email@example.com"
    expr = filter_expr.strip()
    if "userName" in expr and "eq" in expr:
        parts = expr.split('"')
        if len(parts) >= 2:
            return parts[1].strip().lower()
    return None


def _parse_filter_display_name(filter_expr: str) -> str | None:
    expr = filter_expr.strip()
    if "displayName" in expr and "eq" in expr:
        parts = expr.split('"')
        if len(parts) >= 2:
            return parts[1].strip()
    return None


def _member_ids(members) -> list:
    if isinstance(members, dict):
        members = [members]
    return [m.get("value") for m in members if m.get("value")]


def _sync_group_members(sso_config, team: Team, members: list) -> None:
    role = sso_config.default_role
    if role is None:
        raise ValueError("default_role must be set on SSO config for SCIM group sync")
    unassigned = None
    for member in members:
        user_id = member.get("value") if isinstance(member, dict) else member
        if not user_id:
            continue
        user = User.objects.filter(id=user_id).first()
        if not user:
            continue
        TeamMembership.objects.get_or_create(
            team=team, user=user, defaults={"role": role}
        )
        if sso_config.scim_enable_push_groups:
            if unassigned is None:
                unassigned = _get_or_create_unassigned_team(sso_config.tenant, sso_config.project)
            TeamMembership.objects.filter(team=unassigned, user=user).delete()
