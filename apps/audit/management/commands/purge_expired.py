"""
Management command: purge_expired

Enforces RetentionPolicy per project and data type.
Deletes data older than retention_days for:
  - monitor_checks
  - webhook_deliveries
  - incidents_resolved
  - audit_logs (only if explicitly configured — default is NEVER purge)

AuditLog is NEVER deleted unless data_type='audit_logs' AND retention_days is set.
HIPAA/PCI DSS require 6-7 year retention; default keeps forever.

Scheduled daily at 03:00 UTC by run_scheduler. Manual: python manage.py purge_expired
"""
import logging
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.audit.models import DataType, RetentionPolicy

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Purge expired data based on per-project RetentionPolicy."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show what would be deleted without actually deleting.",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        total_deleted = 0

        for policy in RetentionPolicy.objects.select_related("project", "tenant").all():
            cutoff = timezone.now() - timedelta(days=policy.retention_days)
            deleted = self._purge(policy, cutoff, dry_run)
            if deleted:
                self.stdout.write(
                    f"  {'[DRY]' if dry_run else '✓'} "
                    f"{policy.project.name} / {policy.data_type}: "
                    f"{deleted} records {'would be' if dry_run else ''} deleted "
                    f"(older than {cutoff.date()})"
                )
                total_deleted += deleted

        verb = "Would delete" if dry_run else "Deleted"
        self.stdout.write(self.style.SUCCESS(f"{verb} {total_deleted} records total."))

    def _purge(self, policy: RetentionPolicy, cutoff, dry_run: bool) -> int:
        dt = policy.data_type

        if dt == DataType.MONITOR_CHECKS:
            return self._purge_qs(
                __import__("apps.monitoring.models", fromlist=["MonitorCheck"])
                .MonitorCheck.objects.filter(
                    tenant=policy.tenant,
                    monitor__project=policy.project,
                    checked_at__lt=cutoff,
                ),
                dry_run,
            )

        elif dt == DataType.WEBHOOK_DELIVERIES:
            return self._purge_qs(
                __import__("apps.webhooks.models", fromlist=["WebhookDelivery"])
                .WebhookDelivery.objects.filter(
                    tenant=policy.tenant,
                    webhook__project=policy.project,
                    created_at__lt=cutoff,
                ),
                dry_run,
            )

        elif dt == DataType.INCIDENTS_RESOLVED:
            return self._purge_qs(
                __import__("apps.incidents.models", fromlist=["Incident"])
                .Incident.objects.filter(
                    tenant=policy.tenant,
                    project=policy.project,
                    state__is_resolved_state=True,
                    resolved_at__lt=cutoff,
                ),
                dry_run,
            )

        elif dt == DataType.AUDIT_LOGS:
            # Extra safety: only purge if explicitly configured AND retention < 2555d (7y)
            if policy.retention_days >= 2555:
                self.stdout.write(
                    f"  ⚠ Skipping audit_logs for {policy.project.name} "
                    f"(retention={policy.retention_days}d >= 7y — treat as permanent)"
                )
                return 0
            from apps.audit.models import AuditLog
            qs = AuditLog.objects.filter(
                tenant=policy.tenant,
                project=policy.project,
                created_at__lt=cutoff,
            )
            count = qs.count()
            if not dry_run and count:
                # Direct SQL DELETE to bypass the RULE (admin purge only)
                from django.db import connection
                with connection.cursor() as c:
                    c.execute(
                        "DELETE FROM audit_log WHERE tenant_id = %s "
                        "AND project_id = %s AND created_at < %s",
                        [str(policy.tenant.id), str(policy.project.id), cutoff],
                    )
            return count

        return 0

    @staticmethod
    def _purge_qs(qs, dry_run: bool) -> int:
        count = qs.count()
        if not dry_run and count:
            qs.delete()
        return count
