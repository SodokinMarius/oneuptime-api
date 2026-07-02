# Generated manually

import uuid

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("incidents", "0003_add_team"),
        ("webhooks", "0002_add_team"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="EscalationPolicy",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("name", models.CharField(max_length=200)),
                ("description", models.TextField(blank=True)),
                ("is_default", models.BooleanField(default=False)),
                ("is_active", models.BooleanField(default=True)),
                ("severity_names", models.JSONField(blank=True, default=list)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("project", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="escalation_policies", to="tenancy.project")),
                ("team", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="escalation_policies", to="rbac.team")),
                ("tenant", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="escalation_policies", to="tenancy.tenant")),
            ],
            options={
                "db_table": "incidents_escalation_policy",
                "ordering": ["name"],
            },
        ),
        migrations.CreateModel(
            name="EscalationStep",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("order", models.PositiveSmallIntegerField(default=1)),
                ("delay_minutes", models.PositiveIntegerField(default=15)),
                ("action", models.CharField(choices=[("notify_webhook", "Notify webhook"), ("notify_user", "Notify user"), ("increase_severity", "Increase severity"), ("assign_user", "Assign user")], max_length=30)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("policy", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="steps", to="incidents.escalationpolicy")),
                ("target_severity", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="escalation_steps", to="incidents.incidentseverity")),
                ("user", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="escalation_steps", to=settings.AUTH_USER_MODEL)),
                ("webhook", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="escalation_steps", to="webhooks.webhook")),
            ],
            options={
                "db_table": "incidents_escalation_step",
                "ordering": ["order"],
            },
        ),
        migrations.CreateModel(
            name="IncidentEscalationState",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("current_step_order", models.PositiveSmallIntegerField(default=0)),
                ("last_escalated_at", models.DateTimeField(blank=True, null=True)),
                ("completed", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("incident", models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name="escalation_state", to="incidents.incident")),
                ("policy", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="incident_states", to="incidents.escalationpolicy")),
            ],
            options={
                "db_table": "incidents_escalation_state",
            },
        ),
        migrations.CreateModel(
            name="IncidentWorkflowRule",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("name", models.CharField(max_length=200)),
                ("trigger", models.CharField(choices=[("incident_created", "Incident created"), ("incident_unacknowledged", "Incident unacknowledged"), ("incident_resolved", "Incident resolved")], max_length=40)),
                ("conditions", models.JSONField(blank=True, default=dict)),
                ("actions", models.JSONField(default=list)),
                ("is_active", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("project", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="incident_workflow_rules", to="tenancy.project")),
                ("tenant", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="incident_workflow_rules", to="tenancy.tenant")),
            ],
            options={
                "db_table": "incidents_workflow_rule",
                "ordering": ["name"],
            },
        ),
        migrations.AddIndex(
            model_name="escalationpolicy",
            index=models.Index(fields=["tenant", "project"], name="incidents_es_tenant__a0f0f0_idx"),
        ),
        migrations.AddConstraint(
            model_name="escalationstep",
            constraint=models.UniqueConstraint(fields=("policy", "order"), name="unique_escalation_step_order"),
        ),
        migrations.AddIndex(
            model_name="incidentworkflowrule",
            index=models.Index(fields=["tenant", "project", "trigger"], name="incidents_wf_tenant__b1b1b1_idx"),
        ),
    ]
