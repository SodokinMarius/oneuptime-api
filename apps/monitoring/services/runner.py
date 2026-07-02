"""
Monitor check execution logic.

Called by the run_checks management command (cron every minute).
"""
from django.db import transaction
from django.utils import timezone

from apps.monitoring.models import CheckStatus, Monitor, MonitorCheck, MonitorStatus
from apps.monitoring.services.checks import run_check


def execute_check(monitor: Monitor) -> MonitorCheck:
    """
    Execute a single monitor check and persist the result.
    Also updates monitor.status and creates/resolves incidents.
    """
    check_status, http_code, duration_ms, error = run_check(monitor)

    with transaction.atomic():
        check = MonitorCheck.objects.create(
            tenant=monitor.tenant,
            monitor=monitor,
            checked_at=timezone.now(),
            status=check_status,
            response_status_code=http_code,
            response_time_ms=duration_ms,
            error_message=error,
        )
        _update_monitor_status(monitor, check)

    return check


def _update_monitor_status(monitor: Monitor, check: MonitorCheck) -> None:
    """
    Update monitor.status based on consecutive failure/success counts,
    and open/close incidents accordingly.

    During an active maintenance window, failures are recorded but do not
    transition the monitor offline or open incidents.
    """
    from apps.maintenance.services import is_monitor_under_maintenance

    under_maintenance = is_monitor_under_maintenance(monitor)

    consecutive_failures = (
        MonitorCheck.objects.filter(monitor=monitor)
        .order_by("-checked_at")[: monitor.retries]
        .values_list("status", flat=True)
    )
    all_failed = all(
        s in (CheckStatus.FAILURE, CheckStatus.TIMEOUT, CheckStatus.ERROR)
        for s in consecutive_failures
    )
    all_success = all(s == CheckStatus.SUCCESS for s in consecutive_failures)

    new_status = monitor.status
    previous_status = monitor.status

    if all_failed and monitor.status == MonitorStatus.OPERATIONAL:
        if not under_maintenance:
            new_status = MonitorStatus.OFFLINE
            if monitor.alert_on_failure:
                _open_incident(monitor, check)

    elif all_success and monitor.status == MonitorStatus.OFFLINE:
        new_status = MonitorStatus.OPERATIONAL
        _close_incident(monitor)

    now = timezone.now()
    Monitor.objects.filter(pk=monitor.pk).update(
        status=new_status,
        last_check_at=check.checked_at,
        next_check_at=now + __import__("datetime").timedelta(seconds=monitor.interval_seconds),
    )
    monitor.status = new_status
    monitor.last_check_at = check.checked_at

    if new_status != previous_status:
        from apps.monitoring.services.webhooks import emit_monitor_status_changed

        emit_monitor_status_changed(monitor, previous_status)


def _open_incident(monitor: Monitor, check: MonitorCheck) -> None:
    """Auto-create an incident when a monitor goes offline."""
    from apps.incidents.models import Incident, IncidentSeverity, IncidentState

    triggered_state = IncidentState.objects.filter(
        project=monitor.project, name="triggered"
    ).first()
    critical_severity = IncidentSeverity.objects.filter(
        project=monitor.project, name="critical"
    ).first()

    if not triggered_state or not critical_severity:
        return

    incident = Incident.objects.create(
        tenant=monitor.tenant,
        project=monitor.project,
        team=monitor.team,
        monitor=monitor,
        title=f"{monitor.name} is offline",
        description=check.error_message or "Monitor check failed",
        severity=critical_severity,
        state=triggered_state,
    )
    check.triggered_incident = incident
    check.save(update_fields=["triggered_incident"])

    Monitor.objects.filter(pk=monitor.pk).update(current_incident=incident)

    from apps.incidents.services import emit_incident_created

    emit_incident_created(incident)


def _close_incident(monitor: Monitor) -> None:
    """Auto-resolve the open incident when a monitor recovers."""
    from apps.incidents.models import IncidentState

    if not monitor.current_incident_id:
        return

    resolved_state = IncidentState.objects.filter(
        project=monitor.project, is_resolved_state=True
    ).first()
    if not resolved_state:
        return

    from apps.incidents.models import Incident
    Incident.objects.filter(pk=monitor.current_incident_id).update(
        state=resolved_state,
        resolved_at=timezone.now(),
    )
    Monitor.objects.filter(pk=monitor.pk).update(current_incident=None)


def reevaluate_monitors_after_maintenance(maintenance) -> None:
    """Open incidents for monitors still failing when a maintenance window ends."""
    from apps.maintenance.services import monitors_for_maintenance

    for monitor in monitors_for_maintenance(maintenance):
        reevaluate_monitor_incident(monitor)


def reevaluate_monitor_incident(monitor: Monitor) -> None:
    """If checks are still failing after maintenance, mark offline and open incident."""
    from apps.maintenance.services import is_monitor_under_maintenance

    if is_monitor_under_maintenance(monitor):
        return
    if not monitor.alert_on_failure or monitor.current_incident_id:
        return

    recent = list(
        MonitorCheck.objects.filter(monitor=monitor)
        .order_by("-checked_at")[: monitor.retries]
        .values_list("status", flat=True)
    )
    if len(recent) < monitor.retries:
        return

    all_failed = all(
        s in (CheckStatus.FAILURE, CheckStatus.TIMEOUT, CheckStatus.ERROR)
        for s in recent
    )
    if not all_failed:
        return

    if monitor.status != MonitorStatus.OFFLINE:
        previous_status = monitor.status
        Monitor.objects.filter(pk=monitor.pk).update(status=MonitorStatus.OFFLINE)
        monitor.status = MonitorStatus.OFFLINE
        from apps.monitoring.services.webhooks import emit_monitor_status_changed

        emit_monitor_status_changed(monitor, previous_status)

    last_check = MonitorCheck.objects.filter(monitor=monitor).order_by("-checked_at").first()
    if last_check:
        _open_incident(monitor, last_check)
