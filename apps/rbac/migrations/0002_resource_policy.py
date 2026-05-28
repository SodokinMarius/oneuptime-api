import uuid

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("rbac", "0001_initial"),
        ("tenancy", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="ResourcePolicy",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ("resource_type", models.CharField(db_index=True, max_length=50)),
                ("resource_id", models.UUIDField(blank=True, db_index=True, null=True)),
                (
                    "effect",
                    models.CharField(
                        choices=[("allow", "Allow"), ("deny", "Deny")],
                        default="allow",
                        max_length=10,
                    ),
                ),
                ("conditions", models.JSONField(blank=True, default=dict)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "tenant",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="resource_policies",
                        to="tenancy.tenant",
                    ),
                ),
                (
                    "project",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="resource_policies",
                        to="tenancy.project",
                    ),
                ),
                (
                    "role",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="resource_policies",
                        to="rbac.role",
                    ),
                ),
            ],
            options={
                "db_table": "rbac_resource_policy",
                "ordering": ["-created_at"],
            },
        ),
        migrations.AddIndex(
            model_name="resourcepolicy",
            index=models.Index(
                fields=["project", "resource_type"],
                name="rbac_rp_project_rtype_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="resourcepolicy",
            index=models.Index(
                fields=["role", "resource_type", "resource_id"],
                name="rbac_rp_role_rtype_rid_idx",
            ),
        ),
    ]
