"""
Run the background job scheduler (APScheduler).

Use a dedicated process/container — do not run alongside gunicorn workers.

  python manage.py run_scheduler
"""
from django.core.management.base import BaseCommand

from apps.scheduler.jobs import start_scheduler


class Command(BaseCommand):
    help = "Run APScheduler for monitor checks, maintenance, webhooks, and retention purge."

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS("Scheduler starting — Ctrl+C to stop."))
        start_scheduler()
