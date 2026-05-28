"""
RBAC app — Role, Team, TeamMembership, ApiKey.

Maps to OneUptime document §4 (Advanced RBAC) and §19 (Teams, Users, RBAC).
"""
import hashlib
import secrets
import uuid

from django.db import models
from django.utils import timezone


class Role(models.Model):
    """
    A role is a named collection of permission strings (resource:action).

    System roles (is_system=True) are created automatically per project
    and cannot be deleted or have their name changed.

    Built-in roles per project:
      - admin   → ["*"]
      - member  → [list of safe permissions]
      - viewer  → ["*:read"]
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(
        "tenancy.Tenant", on_delete=models.CASCADE, related_name="roles"
    )
    project = models.ForeignKey(
        "tenancy.Project", on_delete=models.CASCADE, related_name="roles"
    )
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    is_system = models.BooleanField(default=False)
    permissions = models.JSONField(default=list)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = "rbac"
        db_table = "rbac_role"
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(
                fields=["project", "name"], name="unique_role_name_per_project"
            )
        ]
        indexes = [
            models.Index(fields=["tenant", "project"]),
        ]

    def __str__(self):
        return f"{self.project.name} / {self.name}"


class Team(models.Model):
    """A team groups users within a project and assigns them a role."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(
        "tenancy.Tenant", on_delete=models.CASCADE, related_name="teams"
    )
    project = models.ForeignKey(
        "tenancy.Project", on_delete=models.CASCADE, related_name="teams"
    )
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = "rbac"
        db_table = "rbac_team"
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(
                fields=["project", "name"], name="unique_team_name_per_project"
            )
        ]
        indexes = [
            models.Index(fields=["tenant", "project"]),
        ]

    def __str__(self):
        return f"{self.project.name} / {self.name}"


class TeamMembership(models.Model):
    """Links a User to a Team with a specific Role."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    team = models.ForeignKey(Team, on_delete=models.CASCADE, related_name="memberships")
    user = models.ForeignKey(
        "accounts.User", on_delete=models.CASCADE, related_name="team_memberships"
    )
    role = models.ForeignKey(Role, on_delete=models.PROTECT, related_name="team_memberships")
    granted_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="granted_memberships",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        app_label = "rbac"
        db_table = "rbac_team_membership"
        constraints = [
            models.UniqueConstraint(
                fields=["team", "user"], name="unique_user_per_team"
            )
        ]
        indexes = [
            models.Index(fields=["user", "team"]),
        ]

    def __str__(self):
        return f"{self.user.email} in {self.team.name} as {self.role.name}"


class ResourcePolicy(models.Model):
    """
    Fine-grained allow/deny policy on a specific resource (or all resources of a type).

    The policy engine checks these after role-level permissions.
    A 'deny' effect overrides any 'allow' from the role.

    resource_id=None means the policy applies to ALL resources of resource_type.
    """
    EFFECT_ALLOW = "allow"
    EFFECT_DENY = "deny"
    EFFECT_CHOICES = [(EFFECT_ALLOW, "Allow"), (EFFECT_DENY, "Deny")]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(
        "tenancy.Tenant", on_delete=models.CASCADE, related_name="resource_policies"
    )
    project = models.ForeignKey(
        "tenancy.Project", on_delete=models.CASCADE, related_name="resource_policies"
    )
    role = models.ForeignKey(
        Role, on_delete=models.CASCADE, related_name="resource_policies"
    )
    resource_type = models.CharField(max_length=50, db_index=True)
    resource_id = models.UUIDField(null=True, blank=True, db_index=True)
    effect = models.CharField(max_length=10, choices=EFFECT_CHOICES, default=EFFECT_ALLOW)
    conditions = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = "rbac"
        db_table = "rbac_resource_policy"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["project", "resource_type"]),
            models.Index(fields=["role", "resource_type", "resource_id"]),
        ]

    def __str__(self):
        target = str(self.resource_id) if self.resource_id else "*"
        return f"{self.effect.upper()} {self.resource_type}:{target} → {self.role.name}"


def _generate_api_key() -> str:
    """Generate a raw API key: ok_live_<32 hex chars>."""
    return f"ok_live_{secrets.token_hex(32)}"


class ApiKey(models.Model):
    """
    Project-scoped API key. Only the SHA-256 hash is stored.
    The raw key is returned once at creation and never stored.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(
        "tenancy.Tenant", on_delete=models.CASCADE, related_name="api_keys"
    )
    project = models.ForeignKey(
        "tenancy.Project", on_delete=models.CASCADE, related_name="api_keys"
    )
    name = models.CharField(max_length=200)
    key_prefix = models.CharField(max_length=16)
    key_hash = models.CharField(max_length=64, unique=True, db_index=True)
    permissions = models.JSONField(default=list)
    created_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        related_name="api_keys_created",
    )
    last_used_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    revoked_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = "rbac"
        db_table = "rbac_api_key"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["tenant", "project"]),
            models.Index(fields=["key_hash"]),
        ]

    def __str__(self):
        return f"{self.name} ({self.key_prefix}...)"

    @property
    def is_active(self) -> bool:
        if self.revoked_at:
            return False
        if self.expires_at and self.expires_at < timezone.now():
            return False
        return True

    @classmethod
    def create_key(cls, tenant, project, name, permissions, created_by, expires_at=None):
        """
        Create an ApiKey and return (instance, raw_key).
        raw_key is shown once — store it securely.
        """
        raw_key = _generate_api_key()
        key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
        instance = cls.objects.create(
            tenant=tenant,
            project=project,
            name=name,
            key_prefix=raw_key[:12],
            key_hash=key_hash,
            permissions=permissions,
            created_by=created_by,
            expires_at=expires_at,
        )
        return instance, raw_key
