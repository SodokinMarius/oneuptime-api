"""
Migration: Row-Level Security policies for all tenant-scoped tables.

Each table that has a `tenant_id` column gets:
  1. ROW LEVEL SECURITY enabled
  2. A policy that restricts access to rows matching the current tenant
     (set via `SET app.current_tenant = '<uuid>'` in TenantMiddleware)

The `missing_ok=true` flag in `current_setting()` ensures that:
  - Superuser admin routes (no tenant context set) are NOT blocked
  - Scheduler jobs that query across all tenants still work

For production hardening, the Django DB user should NOT be a superuser
and `ALTER TABLE ... FORCE ROW LEVEL SECURITY` should be applied so even
the table owner is subject to the policy.
"""
from django.db import migrations


# Tables with a direct tenant_id column
TENANT_SCOPED_TABLES = [
    # tenancy
    "tenancy_project",
    # rbac
    "rbac_role",
    "rbac_team",
    "rbac_team_membership",
    "rbac_api_key",
    "rbac_resource_policy",
    # monitoring
    "monitoring_probe",
    "monitoring_monitor",
    "monitoring_monitorgroup",
    "monitoring_monitorcheck",
    # incidents
    "incidents_incident",
    "incidents_incidentnote",
    "incidents_incidentpostmortem",
    "incidents_incidentstate",
    "incidents_incidentseverity",
    # maintenance
    "maintenance_scheduledmaintenance",
    # status pages
    "status_pages_page",
    "status_pages_resource",
    "status_pages_subscriber",
    "status_pages_announcement",
    # webhooks
    "webhooks_webhook",
    "webhooks_delivery",
    # audit
    "audit_log",
    "audit_retention_policy",
]

_ENABLE_RLS = """
ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON {table}
  USING (
    tenant_id = NULLIF(
      current_setting('app.current_tenant', true), ''
    )::uuid
    OR current_setting('app.current_tenant', true) IS NULL
    OR current_setting('app.current_tenant', true) = ''
  );
"""

_DISABLE_RLS = """
DROP POLICY IF EXISTS tenant_isolation ON {table};
ALTER TABLE {table} DISABLE ROW LEVEL SECURITY;
"""


def apply_rls(apps, schema_editor):
    conn = schema_editor.connection
    for table in TENANT_SCOPED_TABLES:
        # Each table gets its own cursor so a failure on one table does not
        # abort the entire statement sequence (atomic=False, but psycopg still
        # tracks per-connection transaction state).
        try:
            with conn.cursor() as cursor:
                cursor.execute(_ENABLE_RLS.format(table=table))
        except Exception:
            # Table does not exist yet — skip and continue with the next one.
            conn.rollback()


def revert_rls(apps, schema_editor):
    conn = schema_editor.connection
    for table in TENANT_SCOPED_TABLES:
        try:
            with conn.cursor() as cursor:
                cursor.execute(_DISABLE_RLS.format(table=table))
        except Exception:
            conn.rollback()


class Migration(migrations.Migration):
    # Must run outside a transaction: ALTER TABLE ... ENABLE ROW LEVEL SECURITY
    # and CREATE POLICY are DDL statements that cannot participate in a rolled-back
    # transaction. Using atomic=False lets each statement succeed or fail independently.
    atomic = False

    dependencies = [
        ("tenancy", "0001_initial"),
        ("rbac", "0002_resource_policy"),
        ("audit", "0002_auditlog_immutability_rules"),
    ]

    operations = [
        migrations.RunPython(apply_rls, revert_rls),
    ]
