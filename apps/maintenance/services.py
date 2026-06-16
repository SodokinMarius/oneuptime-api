"""
Maintenance window business logic — alert suppression, status page, notifications.
"""
import logging

from django.db.models import Count, Q
from django.utils import timezone

from apps.maintenance.models import MaintenanceStatus, ScheduledMaintenance

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

    from apps.monitoring.services.runner import reevaluate_monitors_after_maintenance

    try:
        reevaluate_monitors_after_maintenance(maintenance)
    except Exception as exc:
        logger.exception("Monitor re-evaluation failed after maintenance %s: %s", maintenance.id, exc)
