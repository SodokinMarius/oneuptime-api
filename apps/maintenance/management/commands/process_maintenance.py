"""
Management command: process_maintenance

Transitions maintenance windows based on time:
  scheduled  → in_progress  when starts_at <= now
  in_progress → completed   when ends_at <= now

Scheduled every minute by run_scheduler. Manual: python manage.py process_maintenance
"""
import logging

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.maintenance.models import MaintenanceStatus, ScheduledMaintenance

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Transition scheduled maintenance windows based on current time."

    def handle(self, *args, **options):
        now = timezone.now()
        started = ended = 0

        # scheduled → in_progress
        to_start = ScheduledMaintenance.objects.filter(
            status=MaintenanceStatus.SCHEDULED,
            starts_at__lte=now,
        )
        for mw in to_start:
            mw.status = MaintenanceStatus.IN_PROGRESS
            mw.save(update_fields=["status", "updated_at"])
            self._emit("scheduled_maintenance.started", mw)
            self.stdout.write(f"  → Started: {mw.title}")
            started += 1

        # in_progress → completed
        to_end = ScheduledMaintenance.objects.filter(
            status=MaintenanceStatus.IN_PROGRESS,
            ends_at__lte=now,
        )
        for mw in to_end:
            mw.status = MaintenanceStatus.COMPLETED
            mw.save(update_fields=["status", "updated_at"])
            self._emit("scheduled_maintenance.ended", mw)
            self.stdout.write(f"  ✓ Completed: {mw.title}")
            ended += 1

        if started or ended:
            self.stdout.write(
                self.style.SUCCESS(f"Maintenance: {started} started, {ended} completed.")
            )

    @staticmethod
    def _emit(event_type: str, maintenance):
        try:
            from apps.maintenance.serializers import ScheduledMaintenanceSerializer
            from apps.webhooks.services import WebhookService
            WebhookService.emit(
                tenant=maintenance.tenant,
                project=maintenance.project,
                event_type=event_type,
                payload={
                    "scheduled_maintenance": ScheduledMaintenanceSerializer(maintenance).data
                },
            )
        except Exception as exc:
            logger.warning("Webhook emit failed for %s: %s", event_type, exc)
