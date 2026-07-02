"""
Maintenance window business logic — alert suppression, status page, notifications.
"""
import logging
import uuid
from calendar import monthrange
from datetime import timedelta

from django.db.models import Count, Q
from django.utils import timezone

from apps.maintenance.models import (
    MaintenanceStatus,
    RecurrenceFrequency,
    ScheduledMaintenance,
)

logger = logging.getLogger(__name__)


def active_maintenances_qs(*, project=None):
    qs = ScheduledMaintenance.objects.filter(status=MaintenanceStatus.IN_PROGRESS)
    if project is not None:
        qs = qs.filter(project=project)
    return qs


def maintenance_covers_monitor(maintenance: ScheduledMaintenance, monitor) -> bool:
    """Empty monitors M2M = project-wide maintenance window."""
    if not maintenance.monitors.exists():
        return maintenance.project_id == monitor.project_id
    return maintenance.monitors.filter(pk=monitor.pk).exists()


def is_monitor_under_maintenance(monitor) -> bool:
    """True if monitor is covered by an in-progress maintenance window."""
    return (
        active_maintenances_qs(project=monitor.project)
        .annotate(monitor_count=Count("monitors"))
        .filter(Q(monitors=monitor) | Q(monitor_count=0))
        .exists()
    )


def monitors_for_maintenance(maintenance: ScheduledMaintenance):
    """Monitors affected by this window (all project monitors if M2M is empty)."""
    from apps.monitoring.models import Monitor

    linked = maintenance.monitors.all()
    if linked.exists():
        return linked
    return Monitor.objects.filter(project=maintenance.project, is_paused=False).exclude(
        status="disabled"
    )


def visible_maintenances_for_status_page(status_page):
    """In-progress maintenances visible on a public status page."""
    from apps.status_pages.models import StatusPageResource

    page_monitor_ids = StatusPageResource.objects.filter(
        status_page=status_page,
        monitor__isnull=False,
    ).values_list("monitor_id", flat=True)

    return (
        ScheduledMaintenance.objects.filter(
            project=status_page.project,
            status=MaintenanceStatus.IN_PROGRESS,
            is_visible_on_status_page=True,
        )
        .annotate(monitor_count=Count("monitors"))
        .filter(Q(monitor_count=0) | Q(monitors__in=page_monitor_ids))
        .distinct()
        .order_by("-starts_at")
    )


def status_pages_for_maintenance(maintenance: ScheduledMaintenance):
    """Public status pages that should receive subscriber notifications."""
    from apps.status_pages.models import StatusPage, StatusPageResource

    pages = StatusPage.objects.filter(project=maintenance.project, is_public=True)
    if not maintenance.monitors.exists():
        return pages

    page_ids = (
        StatusPageResource.objects.filter(
            status_page__project=maintenance.project,
            monitor__in=maintenance.monitors.all(),
        )
        .values_list("status_page_id", flat=True)
        .distinct()
    )
    return pages.filter(id__in=page_ids)


def emit_maintenance_webhook(event_type: str, maintenance: ScheduledMaintenance) -> None:
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


def handle_maintenance_started(maintenance: ScheduledMaintenance) -> None:
    emit_maintenance_webhook("scheduled_maintenance.started", maintenance)
    if maintenance.notify_subscribers:
        from apps.maintenance.notifications import MaintenanceNotificationService

        try:
            MaintenanceNotificationService.notify_started(maintenance)
        except Exception as exc:
            logger.warning("Subscriber notification failed (started): %s", exc)


def handle_maintenance_ended(maintenance: ScheduledMaintenance) -> None:
    emit_maintenance_webhook("scheduled_maintenance.ended", maintenance)
    if maintenance.notify_subscribers:
        from apps.maintenance.notifications import MaintenanceNotificationService

        try:
            MaintenanceNotificationService.notify_ended(maintenance)
        except Exception as exc:
            logger.warning("Subscriber notification failed (ended): %s", exc)

    try:
        schedule_next_occurrence(maintenance)
    except Exception as exc:
        logger.warning("Failed to schedule next maintenance occurrence: %s", exc)

    from apps.monitoring.services.runner import reevaluate_monitors_after_maintenance

    try:
        reevaluate_monitors_after_maintenance(maintenance)
    except Exception as exc:
        logger.exception("Monitor re-evaluation failed after maintenance %s: %s", maintenance.id, exc)


def _add_months(dt, months: int):
    month_index = dt.month - 1 + months
    year = dt.year + month_index // 12
    month = month_index % 12 + 1
    day = min(dt.day, monthrange(year, month)[1])
    return dt.replace(year=year, month=month, day=day)


def ensure_series_id(maintenance: ScheduledMaintenance) -> uuid.UUID:
    if maintenance.series_id:
        return maintenance.series_id
    sid = uuid.uuid4()
    maintenance.series_id = sid
    maintenance.save(update_fields=["series_id", "updated_at"])
    return sid


def schedule_next_occurrence(maintenance: ScheduledMaintenance) -> ScheduledMaintenance | None:
    """Create the next scheduled window when a recurring maintenance completes."""
    if maintenance.recurrence_frequency == RecurrenceFrequency.NONE:
        return None
    if maintenance.recurrence_until and timezone.now() >= maintenance.recurrence_until:
        return None

    duration = maintenance.ends_at - maintenance.starts_at
    next_start = _next_recurrence_start(maintenance)
    if next_start is None:
        return None
    if maintenance.recurrence_until and next_start >= maintenance.recurrence_until:
        return None

    series_id = ensure_series_id(maintenance)
    next_end = next_start + duration

    clone = ScheduledMaintenance.objects.create(
        tenant=maintenance.tenant,
        project=maintenance.project,
        team=maintenance.team,
        title=maintenance.title,
        description=maintenance.description,
        starts_at=next_start,
        ends_at=next_end,
        status=MaintenanceStatus.SCHEDULED,
        is_visible_on_status_page=maintenance.is_visible_on_status_page,
        notify_subscribers=maintenance.notify_subscribers,
        recurrence_frequency=maintenance.recurrence_frequency,
        recurrence_interval=maintenance.recurrence_interval,
        recurrence_weekdays=list(maintenance.recurrence_weekdays or []),
        recurrence_until=maintenance.recurrence_until,
        series_id=series_id,
    )
    clone.monitors.set(maintenance.monitors.all())
    return clone


def _next_recurrence_start(maintenance: ScheduledMaintenance):
    freq = maintenance.recurrence_frequency
    interval = max(1, maintenance.recurrence_interval or 1)
    current = maintenance.starts_at

    if freq == RecurrenceFrequency.DAILY:
        return current + timedelta(days=interval)

    if freq == RecurrenceFrequency.WEEKLY:
        weekdays = maintenance.recurrence_weekdays or [current.weekday()]
        candidate = current + timedelta(days=1)
        for _ in range(366):
            if candidate.weekday() in weekdays and candidate > current:
                return candidate.replace(
                    hour=current.hour,
                    minute=current.minute,
                    second=current.second,
                    microsecond=current.microsecond,
                )
            candidate += timedelta(days=1)
        return current + timedelta(weeks=interval)

    if freq == RecurrenceFrequency.MONTHLY:
        return _add_months(current, interval)

    return None
