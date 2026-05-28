"""
Monitor check execution logic.

Supports: api, website (both HTTP), tcp (socket), heartbeat (last_seen_at age).
ping type falls back to HTTP if url is provided, otherwise skipped with a warning.

Called by the run_checks management command (cron every minute).
"""
import socket
import time

import requests as http_requests
from django.db import transaction
from django.utils import timezone

from apps.monitoring.models import CheckStatus, Monitor, MonitorCheck, MonitorStatus

_HTTP_TIMEOUT_HARD = 60  # never wait more than this regardless of monitor config


def _evaluate_criteria(response, duration_ms: int, criteria: dict) -> tuple[bool, str]:
    """
    Evaluate a monitor's criteria dict against an HTTP response.
    Returns (passed: bool, reason: str).
    """
    if not criteria:
        return True, ""

    # Status code check
    sc_rule = criteria.get("response_status_code")
    if sc_rule:
        op = sc_rule.get("operator", "equals")
        val = sc_rule.get("value", 200)
        actual = response.status_code
        if op == "equals" and actual != val:
            return False, f"status_code {actual} != {val}"
        if op == "not_equals" and actual == val:
            return False, f"status_code {actual} == {val} (not_equals failed)"
        if op == "lt" and actual >= val:
            return False, f"status_code {actual} >= {val}"
        if op == "gt" and actual <= val:
            return False, f"status_code {actual} <= {val}"

    # Response body check
    body_rule = criteria.get("response_body")
    if body_rule:
        op = body_rule.get("operator", "contains")
        val = body_rule.get("value", "")
        body = response.text
        if op == "contains" and val not in body:
            return False, f"body does not contain '{val}'"
        if op == "not_contains" and val in body:
            return False, f"body contains '{val}' (not_contains failed)"
        if op == "equals" and body != val:
            return False, "body does not match expected value"

    # Response time check
    rt_rule = criteria.get("response_time_ms")
    if rt_rule:
        op = rt_rule.get("operator", "lt")
        val = rt_rule.get("value", 2000)
        if op == "lt" and duration_ms >= val:
            return False, f"response_time {duration_ms}ms >= {val}ms"
        if op == "lte" and duration_ms > val:
            return False, f"response_time {duration_ms}ms > {val}ms"

    return True, ""


def _run_http_check(monitor: Monitor) -> tuple[CheckStatus, int | None, int | None, str]:
    """Execute an HTTP/HTTPS check. Returns (status, http_code, duration_ms, error)."""
    timeout = min(monitor.timeout_seconds, _HTTP_TIMEOUT_HARD)
    start = time.monotonic()
    try:
        resp = http_requests.request(
            method=monitor.method or "GET",
            url=monitor.url,
            headers=monitor.headers or {},
            data=monitor.body or None,
            timeout=timeout,
            allow_redirects=True,
            verify=True,
        )
        duration_ms = int((time.monotonic() - start) * 1000)
        passed, reason = _evaluate_criteria(resp, duration_ms, monitor.criteria)
        if passed:
            return CheckStatus.SUCCESS, resp.status_code, duration_ms, ""
        return CheckStatus.FAILURE, resp.status_code, duration_ms, reason
    except http_requests.Timeout:
        duration_ms = int((time.monotonic() - start) * 1000)
        return CheckStatus.TIMEOUT, None, duration_ms, "Request timed out"
    except http_requests.ConnectionError as exc:
        return CheckStatus.ERROR, None, None, f"Connection error: {exc}"
    except Exception as exc:
        return CheckStatus.ERROR, None, None, str(exc)


def _run_tcp_check(monitor: Monitor) -> tuple[CheckStatus, int | None, int | None, str]:
    """TCP port connectivity check. URL format: host:port"""
    url = monitor.url or ""
    try:
        if "://" in url:
            url = url.split("://", 1)[1]
        host, port_str = url.rsplit(":", 1)
        port = int(port_str)
    except (ValueError, AttributeError):
        return CheckStatus.ERROR, None, None, f"Invalid TCP target '{monitor.url}' (expected host:port)"

    timeout = min(monitor.timeout_seconds, _HTTP_TIMEOUT_HARD)
    start = time.monotonic()
    try:
        with socket.create_connection((host, port), timeout=timeout):
            duration_ms = int((time.monotonic() - start) * 1000)
            return CheckStatus.SUCCESS, None, duration_ms, ""
    except socket.timeout:
        return CheckStatus.TIMEOUT, None, None, f"TCP connection to {host}:{port} timed out"
    except OSError as exc:
        return CheckStatus.ERROR, None, None, str(exc)


def _run_heartbeat_check(monitor: Monitor) -> tuple[CheckStatus, int | None, int | None, str]:
    """
    Heartbeat monitor: succeeds if a probe has pinged the monitor's heartbeat URL
    within interval_seconds * 2. For the PoC, we check last_check_at freshness.
    """
    grace = monitor.interval_seconds * 2
    if monitor.last_check_at is None:
        return CheckStatus.SUCCESS, None, None, ""
    age = (timezone.now() - monitor.last_check_at).total_seconds()
    if age > grace:
        return CheckStatus.FAILURE, None, None, f"No heartbeat for {int(age)}s (grace={grace}s)"
    return CheckStatus.SUCCESS, None, None, ""


def execute_check(monitor: Monitor) -> MonitorCheck:
    """
    Execute a single monitor check and persist the result.
    Also updates monitor.status and creates/resolves incidents.
    """
    mtype = monitor.type

    if mtype in ("api", "website"):
        check_status, http_code, duration_ms, error = _run_http_check(monitor)
    elif mtype == "tcp":
        check_status, http_code, duration_ms, error = _run_tcp_check(monitor)
    elif mtype == "heartbeat":
        check_status, http_code, duration_ms, error = _run_heartbeat_check(monitor)
    else:
        # ping or unknown: attempt HTTP if URL is provided
        if monitor.url:
            check_status, http_code, duration_ms, error = _run_http_check(monitor)
        else:
            check_status = CheckStatus.ERROR
            http_code, duration_ms = None, None
            error = f"Monitor type '{mtype}' not supported in PoC"

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
    """
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

    if all_failed and monitor.status == MonitorStatus.OPERATIONAL:
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
        monitor=monitor,
        title=f"{monitor.name} is offline",
        description=check.error_message or "Monitor check failed",
        severity=critical_severity,
        state=triggered_state,
    )
    check.triggered_incident = incident
    check.save(update_fields=["triggered_incident"])

    Monitor.objects.filter(pk=monitor.pk).update(current_incident=incident)


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
