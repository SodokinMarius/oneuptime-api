"""
SSO app — SAML 2.0 Service Provider configuration and SCIM sync logs.

Maps to OneUptime Enterprise document §3 (SSO / SAML 2.0).
"""
import secrets
import uuid

from django.db import models


class SSOProvider(models.TextChoices):
    OKTA = "okta", "Okta"
    AZURE_AD = "azure_ad", "Azure AD"
    GOOGLE = "google", "Google Workspace"
    CUSTOM = "custom", "Custom IdP"


class SSOConfig(models.Model):
    """
    Per-project SAML IdP configuration and SCIM bearer token.

    One active config per project is typical; multiple configs are allowed
    (e.g. staging vs production IdPs) but only enabled ones are used for login.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(
        "tenancy.Tenant", on_delete=models.CASCADE, related_name="sso_configs"
    )
    project = models.ForeignKey(
        "tenancy.Project", on_delete=models.CASCADE, related_name="sso_configs"
    )

    provider = models.CharField(max_length=50, choices=SSOProvider.choices, default=SSOProvider.CUSTOM)
    name = models.CharField(max_length=200, default="Default SSO")
    description = models.TextField(blank=True)

    # IdP settings
    entity_id = models.TextField(help_text="IdP Entity ID / Issuer URL")
    sso_url = models.TextField(help_text="IdP Single Sign-On URL")
    slo_url = models.TextField(blank=True, help_text="IdP Single Logout URL (optional)")
    x509_cert = models.TextField(help_text="IdP X.509 certificate (PEM, without headers)")

    attribute_map = models.JSONField(
        default=dict,
        blank=True,
        help_text="Map IdP attribute URIs to local fields, e.g. {'email': '...', 'first_name': '...'}",
    )
    jit_enabled = models.BooleanField(default=True, help_text="Auto-create users on first SAML login")
    default_role = models.ForeignKey(
        "rbac.Role",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="sso_default_for",
        help_text="Role assigned on JIT provisioning when no team mapping matches",
    )
    default_teams = models.ManyToManyField(
        "rbac.Team",
        blank=True,
        related_name="sso_configs",
        help_text="Teams to add JIT-provisioned users to",
    )

    enforce_sso = models.BooleanField(
        default=False,
        help_text="Block password login for members of this project",
    )
    scim_token = models.CharField(max_length=128, blank=True, db_index=True)
    scim_auto_provision = models.BooleanField(default=True)
    scim_auto_deprovision = models.BooleanField(default=True)
    scim_enable_push_groups = models.BooleanField(default=False)

    is_enabled = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = "sso"
        db_table = "sso_config"
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["project", "name"],
                name="unique_sso_config_name_per_project",
            ),
        ]
        indexes = [
            models.Index(fields=["tenant", "project"]),
            models.Index(fields=["project", "is_enabled"]),
        ]

    def __str__(self):
        return f"{self.project.name} / {self.name}"

    def save(self, *args, **kwargs):
        if not self.scim_token:
            self.scim_token = secrets.token_urlsafe(48)
        super().save(*args, **kwargs)

    def regenerate_scim_token(self) -> str:
        self.scim_token = secrets.token_urlsafe(48)
        self.save(update_fields=["scim_token", "updated_at"])
        return self.scim_token


class SCIMOperation(models.TextChoices):
    CREATE = "create", "Create"
    UPDATE = "update", "Update"
    DELETE = "delete", "Delete"
    DEACTIVATE = "deactivate", "Deactivate"


class SCIMResource(models.TextChoices):
    USER = "user", "User"
    GROUP = "group", "Group"


class SCIMSyncLog(models.Model):
    """Append-only log of SCIM provisioning operations."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    config = models.ForeignKey(
        SSOConfig, on_delete=models.CASCADE, related_name="scim_logs"
    )
    operation = models.CharField(max_length=20, choices=SCIMOperation.choices)
    resource = models.CharField(max_length=20, choices=SCIMResource.choices)
    external_id = models.TextField()
    payload = models.JSONField(null=True, blank=True)
    status = models.CharField(max_length=20, default="success")
    error_message = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        app_label = "sso"
        db_table = "scim_sync_log"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["config", "-created_at"]),
            models.Index(fields=["external_id"]),
        ]

    def __str__(self):
        return f"{self.operation} {self.resource} {self.external_id}"
