"""
Management command: run_checks

Executes all due monitor checks (next_check_at <= now, not paused).
Scheduled every minute by the APScheduler service (python manage.py run_scheduler).
Manual run: make run-checks

Processes up to BATCH_SIZE monitors per invocation to stay within the minute window.
"""
import logging

from django.core.management.base import BaseCommand
from django.db.models import Q
from django.utils import timezone

from apps.monitoring.models import Monitor
from apps.monitoring.services.runner import execute_check

logger = logging.getLogger(__name__)

BATCH_SIZE = 200


class Command(BaseCommand):
    help = "Execute due monitor checks and update statuses."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Print which monitors would be checked without executing.",
        )
        parser.add_argument(
            "--monitor-id",
            type=str,
            help="Run check for a specific monitor UUID only.",
        )

    def handle(self, *args, **options):
        now = timezone.now()
        dry_run = options["dry_run"]

        qs = Monitor.objects.filter(
            is_paused=False,
        ).exclude(
            status="disabled"
        ).select_related("tenant", "project")

        if options["monitor_id"]:
            qs = qs.filter(id=options["monitor_id"])
        else:
            qs = qs.filter(Q(next_check_at__lte=now) | Q(next_check_at__isnull=True))

        monitors = list(qs[:BATCH_SIZE])

        if not monitors:
            self.stdout.write("No monitors due for checking.")
            return

        self.stdout.write(f"Running checks for {len(monitors)} monitor(s)...")

        ok = failed = 0
        for monitor in monitors:
            if dry_run:
                self.stdout.write(f"  [DRY-RUN] Would check: {monitor.name} ({monitor.type})")
                continue
            try:
                check = execute_check(monitor)
                symbol = "✓" if check.status == "success" else "✗"
                self.stdout.write(
                    f"  {symbol} {monitor.name} → {check.status} "
                    f"({check.response_time_ms}ms)"
                )
                ok += 1
            except Exception as exc:
                logger.exception("Error checking monitor %s: %s", monitor.id, exc)
                self.stderr.write(f"  ERROR {monitor.name}: {exc}")
                failed += 1

        if not dry_run:
            self.stdout.write(
                self.style.SUCCESS(f"Done: {ok} ok, {failed} errors.")
            )
