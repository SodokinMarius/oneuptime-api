import uuid

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ("rbac", "0002_resource_policy"),
        ("tenancy", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="SSOConfig",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("provider", models.CharField(
                    choices=[
                        ("okta", "Okta"),
                        ("azure_ad", "Azure AD"),
                        ("google", "Google Workspace"),
                        ("custom", "Custom IdP"),
                    ],
                    default="custom",
                    max_length=50,
                )),
                ("name", models.CharField(default="Default SSO", max_length=200)),
                ("description", models.TextField(blank=True)),
                ("entity_id", models.TextField(help_text="IdP Entity ID / Issuer URL")),
                ("sso_url", models.TextField(help_text="IdP Single Sign-On URL")),
                ("slo_url", models.TextField(blank=True, help_text="IdP Single Logout URL (optional)")),
                ("x509_cert", models.TextField(help_text="IdP X.509 certificate (PEM, without headers)")),
                ("attribute_map", models.JSONField(
                    blank=True,
                    default=dict,
                    help_text="Map IdP attribute URIs to local fields",
                )),
                ("jit_enabled", models.BooleanField(default=True, help_text="Auto-create users on first SAML login")),
                ("enforce_sso", models.BooleanField(
                    default=False,
                    help_text="Block password login for members of this project",
                )),
                ("scim_token", models.CharField(blank=True, db_index=True, max_length=128)),
                ("scim_auto_provision", models.BooleanField(default=True)),
                ("scim_auto_deprovision", models.BooleanField(default=True)),
                ("scim_enable_push_groups", models.BooleanField(default=False)),
                ("is_enabled", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("default_role", models.ForeignKey(
                    blank=True,
                    help_text="Role assigned on JIT provisioning when no team mapping matches",
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name="sso_default_for",
                    to="rbac.role",
                )),
                ("default_teams", models.ManyToManyField(
                    blank=True,
                    help_text="Teams to add JIT-provisioned users to",
                    related_name="sso_configs",
                    to="rbac.team",
                )),
                ("project", models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="sso_configs",
                    to="tenancy.project",
                )),
                ("tenant", models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="sso_configs",
                    to="tenancy.tenant",
                )),
            ],
            options={
                "db_table": "sso_config",
                "ordering": ["-created_at"],
            },
        ),
        migrations.CreateModel(
            name="SCIMSyncLog",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("operation", models.CharField(
                    choices=[
                        ("create", "Create"),
                        ("update", "Update"),
                        ("delete", "Delete"),
                        ("deactivate", "Deactivate"),
                    ],
                    max_length=20,
                )),
                ("resource", models.CharField(
                    choices=[("user", "User"), ("group", "Group")],
                    max_length=20,
                )),
                ("external_id", models.TextField()),
                ("payload", models.JSONField(blank=True, null=True)),
                ("status", models.CharField(default="success", max_length=20)),
                ("error_message", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("config", models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="scim_logs",
                    to="sso.ssoconfig",
                )),
            ],
            options={
                "db_table": "scim_sync_log",
                "ordering": ["-created_at"],
            },
        ),
        migrations.AddIndex(
            model_name="ssoconfig",
            index=models.Index(fields=["tenant", "project"], name="sso_config_tenant__a8f3c2_idx"),
        ),
        migrations.AddIndex(
            model_name="ssoconfig",
            index=models.Index(fields=["project", "is_enabled"], name="sso_config_project_91b4e1_idx"),
        ),
        migrations.AddConstraint(
            model_name="ssoconfig",
            constraint=models.UniqueConstraint(
                fields=("project", "name"),
                name="unique_sso_config_name_per_project",
            ),
        ),
        migrations.AddIndex(
            model_name="scimsynclog",
            index=models.Index(fields=["config", "-created_at"], name="scim_sync_l_config__7d2f10_idx"),
        ),
        migrations.AddIndex(
            model_name="scimsynclog",
            index=models.Index(fields=["external_id"], name="scim_sync_l_externa_3c8a9b_idx"),
        ),
    ]
