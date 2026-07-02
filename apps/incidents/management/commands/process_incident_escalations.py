"""Process incident escalations and unacknowledged workflow rules."""
import logging

from django.core.management.base import BaseCommand

from apps.incidents.services import process_escalations, process_unacknowledged_workflows

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Run pending incident escalations and workflow rules."

    def handle(self, *args, **options):
        escalation_stats = process_escalations()
        workflow_count = process_unacknowledged_workflows()
        self.stdout.write(
            self.style.SUCCESS(
                f"Escalations: {escalation_stats['escalated']} executed, "
                f"{escalation_stats['completed']} completed; "
                f"workflows: {workflow_count} fired."
            )
        )
