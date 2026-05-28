"""
Management command: process_webhook_deliveries

POSTs pending webhook payloads to subscriber URLs (with HMAC signing and retries).
Scheduled every minute by apps.scheduler (run_scheduler).
"""
from django.core.management.base import BaseCommand

from apps.webhooks.services import WebhookService


class Command(BaseCommand):
    help = "Deliver pending webhook events to configured endpoints."

    def add_arguments(self, parser):
        parser.add_argument(
            "--batch-size",
            type=int,
            default=50,
            help="Maximum deliveries to process in one run (default: 50).",
        )

    def handle(self, *args, **options):
        stats = WebhookService.process_pending(batch_size=options["batch_size"])
        if any(stats.values()):
            self.stdout.write(
                self.style.SUCCESS(
                    f"Webhooks: {stats.get('sent', 0)} sent, "
                    f"{stats.get('failed', 0)} failed, "
                    f"{stats.get('exhausted', 0)} exhausted."
                )
            )
        else:
            self.stdout.write("No webhook deliveries due.")
