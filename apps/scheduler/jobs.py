"""
APScheduler job definitions.

Jobs delegate to existing management commands. Started via:
  python manage.py run_scheduler
"""
import logging

from apscheduler.schedulers.blocking import BlockingScheduler
from apscheduler.triggers.cron import CronTrigger
from django.conf import settings
from django.core.management import call_command
from django.db import close_old_connections

logger = logging.getLogger(__name__)


def _run_command(name: str):
    """Run a management command with a fresh DB connection."""
    close_old_connections()
    try:
        call_command(name, verbosity=0)
    except Exception:
        logger.exception("Scheduler job %s failed", name)
    finally:
        close_old_connections()


def job_run_checks():
    _run_command("run_checks")


def job_process_maintenance():
    _run_command("process_maintenance")


def job_process_incident_escalations():
    _run_command("process_incident_escalations")


def job_process_webhooks():
    _run_command("process_webhook_deliveries")


def job_purge_expired():
    _run_command("purge_expired")


def start_scheduler():
    """Blocking scheduler — run in a dedicated process/container."""
    scheduler = BlockingScheduler(timezone=settings.TIME_ZONE)

    scheduler.add_job(
        job_run_checks,
        trigger=CronTrigger(minute="*"),
        id="run_checks",
        name="Execute due monitor checks",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
        misfire_grace_time=30,
    )
    scheduler.add_job(
        job_process_maintenance,
        trigger=CronTrigger(minute="*"),
        id="process_maintenance",
        name="Transition scheduled maintenance windows",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
        misfire_grace_time=30,
    )
    scheduler.add_job(
        job_process_incident_escalations,
        trigger=CronTrigger(minute="*"),
        id="process_incident_escalations",
        name="Process incident escalations and workflows",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
        misfire_grace_time=30,
    )
    scheduler.add_job(
        job_process_webhooks,
        trigger=CronTrigger(minute="*"),
        id="process_webhook_deliveries",
        name="Deliver pending webhook events",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
        misfire_grace_time=30,
    )
    scheduler.add_job(
        job_purge_expired,
        trigger=CronTrigger(hour=3, minute=0),
        id="purge_expired",
        name="Purge data past retention policies",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
        misfire_grace_time=300,
    )

    logger.info(
        "APScheduler started — run_checks, process_maintenance, "
        "process_incident_escalations, process_webhook_deliveries: every minute; "
        "purge_expired: 03:00 %s",
        settings.TIME_ZONE,
    )
    try:
        scheduler.start()
    except (KeyboardInterrupt, SystemExit):
        scheduler.shutdown(wait=False)
        logger.info("Scheduler stopped.")
