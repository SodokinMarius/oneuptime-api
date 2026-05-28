"""
Migration: add PostgreSQL RULE to make audit_log table immutable.

UPDATE and DELETE on audit_log are silently ignored at the database level,
regardless of who runs them (including superuser via ORM).
This is the second layer of immutability after the Python-level guard in AuditLog.save().
"""
from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("audit", "0001_initial"),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
                CREATE OR REPLACE RULE audit_no_update
                    AS ON UPDATE TO audit_log
                    DO INSTEAD NOTHING;

                CREATE OR REPLACE RULE audit_no_delete
                    AS ON DELETE TO audit_log
                    DO INSTEAD NOTHING;
            """,
            reverse_sql="""
                DROP RULE IF EXISTS audit_no_update ON audit_log;
                DROP RULE IF EXISTS audit_no_delete ON audit_log;
            """,
        ),
    ]
