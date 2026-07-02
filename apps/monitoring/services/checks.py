"""
Monitor check implementations by type.

Supported: api, website, tcp, udp, dns, ssl, ping, multi_step_api, journey, heartbeat.
"""
from __future__ import annotations

import json
import socket
import ssl
import subprocess
import time
from datetime import datetime, timezone as dt_timezone
from urllib.parse import urlparse

import requests as http_requests

from apps.monitoring.models import CheckStatus, Monitor

_HTTP_TIMEOUT_HARD = 60


def run_check(monitor: Monitor) -> tuple[CheckStatus, int | None, int | None, str]:
    """Dispatch to the appropriate check runner for monitor.type."""
    runners = {
        "api": _run_http_check,
        "website": _run_http_check,
        "tcp": _run_tcp_check,
        "udp": _run_udp_check,
        "dns": _run_dns_check,
        "ssl": _run_ssl_check,
        "ping": _run_ping_check,
        "multi_step_api": _run_multi_step_check,
        "journey": _run_journey_check,
        "heartbeat": _run_heartbeat_check,
    }
    runner = runners.get(monitor.type)
    if runner is None:
        return CheckStatus.ERROR, None, None, f"Unknown monitor type '{monitor.type}'"
    return runner(monitor)


def _evaluate_criteria(response, duration_ms: int, criteria: dict) -> tuple[bool, str]:
    if not criteria:
        return True, ""

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


def _parse_host_port(url: str, default_port: int) -> tuple[str, int]:
    raw = url or ""
    if "://" in raw:
        raw = raw.split("://", 1)[1]
    if "/" in raw:
        raw = raw.split("/", 1)[0]
    if ":" in raw:
        host, port_str = raw.rsplit(":", 1)
        return host, int(port_str)
    return raw, default_port


def _run_tcp_check(monitor: Monitor) -> tuple[CheckStatus, int | None, int | None, str]:
    try:
        host, port = _parse_host_port(monitor.url, 443)
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


def _run_udp_check(monitor: Monitor) -> tuple[CheckStatus, int | None, int | None, str]:
    try:
        host, port = _parse_host_port(monitor.url, 53)
    except (ValueError, AttributeError):
        return CheckStatus.ERROR, None, None, f"Invalid UDP target '{monitor.url}' (expected host:port)"

    criteria = monitor.criteria or {}
    payload = criteria.get("payload", "ping")
    if isinstance(payload, str) and payload.startswith("hex:"):
        message = bytes.fromhex(payload[4:])
    else:
        message = str(payload).encode()

    expect_response = criteria.get("expect_response", False)
    timeout = min(monitor.timeout_seconds, _HTTP_TIMEOUT_HARD)
    start = time.monotonic()
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.settimeout(timeout)
    try:
        sock.sendto(message, (host, port))
        if expect_response:
            sock.recvfrom(4096)
        duration_ms = int((time.monotonic() - start) * 1000)
        return CheckStatus.SUCCESS, None, duration_ms, ""
    except socket.timeout:
        if expect_response:
            return CheckStatus.TIMEOUT, None, None, f"No UDP response from {host}:{port}"
        duration_ms = int((time.monotonic() - start) * 1000)
        return CheckStatus.SUCCESS, None, duration_ms, ""
    except OSError as exc:
        return CheckStatus.ERROR, None, None, str(exc)
    finally:
        sock.close()


def _run_dns_check(monitor: Monitor) -> tuple[CheckStatus, int | None, int | None, str]:
    hostname = (monitor.url or "").strip().rstrip(".")
    if not hostname:
        return CheckStatus.ERROR, None, None, "DNS monitor requires a hostname in url"

    criteria = monitor.criteria or {}
    record_type = (criteria.get("record_type") or "A").upper()
    expected = criteria.get("expected_values") or criteria.get("expected_value")
    if expected is not None and not isinstance(expected, list):
        expected = [expected]

    start = time.monotonic()
    try:
        if record_type in ("A", "AAAA"):
            results = sorted({addr[4][0] for addr in socket.getaddrinfo(hostname, None)})
        else:
            results = _resolve_dns_via_dig(hostname, record_type)
    except socket.gaierror as exc:
        return CheckStatus.FAILURE, None, None, f"DNS lookup failed: {exc}"
    except Exception as exc:
        return CheckStatus.ERROR, None, None, str(exc)

    duration_ms = int((time.monotonic() - start) * 1000)
    if not results:
        return CheckStatus.FAILURE, None, duration_ms, f"No {record_type} records found for {hostname}"

    if expected:
        missing = [v for v in expected if v not in results]
        if missing:
            return (
                CheckStatus.FAILURE,
                None,
                duration_ms,
                f"Expected {record_type} values {expected}, got {results}",
            )

    return CheckStatus.SUCCESS, None, duration_ms, ""


def _resolve_dns_via_dig(hostname: str, record_type: str) -> list[str]:
    proc = subprocess.run(
        ["dig", "+short", hostname, record_type],
        capture_output=True,
        text=True,
        timeout=15,
        check=False,
    )
    if proc.returncode != 0 and not proc.stdout.strip():
        raise RuntimeError(proc.stderr.strip() or f"dig failed for {hostname} {record_type}")
    lines = [line.strip().rstrip(".") for line in proc.stdout.splitlines() if line.strip()]
    if record_type == "MX":
        return sorted(line.split()[-1] for line in lines)
    return sorted(lines)


def _run_ssl_check(monitor: Monitor) -> tuple[CheckStatus, int | None, int | None, str]:
    raw = monitor.url or ""
    if "://" not in raw:
        raw = f"https://{raw}"
    parsed = urlparse(raw)
    hostname = parsed.hostname
    if not hostname:
        return CheckStatus.ERROR, None, None, f"Invalid SSL target '{monitor.url}'"

    port = parsed.port or 443
    criteria = monitor.criteria or {}
    min_days = int(criteria.get("min_days_before_expiry", 14))
    timeout = min(monitor.timeout_seconds, _HTTP_TIMEOUT_HARD)

    start = time.monotonic()
    context = ssl.create_default_context()
    try:
        with socket.create_connection((hostname, port), timeout=timeout) as sock:
            with context.wrap_socket(sock, server_hostname=hostname) as secure:
                cert = secure.getpeercert()
    except ssl.SSLError as exc:
        return CheckStatus.FAILURE, None, None, f"SSL handshake failed: {exc}"
    except OSError as exc:
        return CheckStatus.ERROR, None, None, str(exc)

    duration_ms = int((time.monotonic() - start) * 1000)
    not_after = cert.get("notAfter")
    if not not_after:
        return CheckStatus.FAILURE, None, duration_ms, "Certificate has no expiry date"

    expiry = datetime.strptime(not_after, "%b %d %H:%M:%S %Y %Z").replace(tzinfo=dt_timezone.utc)
    days_left = (expiry - datetime.now(dt_timezone.utc)).days
    if days_left < min_days:
        return (
            CheckStatus.FAILURE,
            None,
            duration_ms,
            f"Certificate expires in {days_left} days (minimum {min_days})",
        )

    if criteria.get("check_hostname_match", True):
        san = [entry[1] for entry in cert.get("subjectAltName", []) if entry[0] == "DNS"]
        cn = next((item[0][1] for item in cert.get("subject", ()) if item[0][0] == "commonName"), None)
        names = set(san + ([cn] if cn else []))
        if names and not _hostname_matches_cert(hostname, names):
            return CheckStatus.FAILURE, None, duration_ms, f"Hostname {hostname} not in certificate SAN/CN"

    return CheckStatus.SUCCESS, None, duration_ms, ""


def _hostname_matches_cert(hostname: str, names: set[str]) -> bool:
    host = hostname.lower()
    for pattern in names:
        p = pattern.lower()
        if p.startswith("*."):
            if host == p[2:] or host.endswith("." + p[2:]):
                return True
        elif host == p:
            return True
    return False


def _run_ping_check(monitor: Monitor) -> tuple[CheckStatus, int | None, int | None, str]:
    host = (monitor.url or "").strip()
    if "://" in host:
        host = urlparse(host).hostname or host
    host = host.split("/")[0]
    if not host:
        return CheckStatus.ERROR, None, None, "Ping monitor requires a hostname in url"

    timeout = min(monitor.timeout_seconds, _HTTP_TIMEOUT_HARD)
    start = time.monotonic()
    try:
        proc = subprocess.run(
            ["ping", "-c", "1", "-W", str(max(1, timeout)), host],
            capture_output=True,
            text=True,
            timeout=timeout + 2,
            check=False,
        )
    except FileNotFoundError:
        return CheckStatus.ERROR, None, None, "ping command not available on this host"
    except subprocess.TimeoutExpired:
        return CheckStatus.TIMEOUT, None, None, f"Ping to {host} timed out"

    duration_ms = int((time.monotonic() - start) * 1000)
    if proc.returncode == 0:
        return CheckStatus.SUCCESS, None, duration_ms, ""

    output = (proc.stdout or proc.stderr or "").strip()
    return CheckStatus.FAILURE, None, duration_ms, output or f"Ping to {host} failed"


def _run_multi_step_check(monitor: Monitor) -> tuple[CheckStatus, int | None, int | None, str]:
    return _execute_http_steps(monitor, monitor.steps or [], think_time_ms=0)


def _run_journey_check(monitor: Monitor) -> tuple[CheckStatus, int | None, int | None, str]:
    criteria = monitor.criteria or {}
    think_time_ms = int(criteria.get("think_time_ms", 500))
    return _execute_http_steps(monitor, monitor.steps or [], think_time_ms=think_time_ms)


def _execute_http_steps(
    monitor: Monitor,
    steps: list,
    *,
    think_time_ms: int,
) -> tuple[CheckStatus, int | None, int | None, str]:
    if not steps:
        return CheckStatus.ERROR, None, None, "At least one step is required"

    timeout = min(monitor.timeout_seconds, _HTTP_TIMEOUT_HARD)
    variables: dict[str, str] = {}
    total_duration = 0
    last_status_code = None

    for index, step in enumerate(steps, start=1):
        if think_time_ms > 0 and index > 1:
            time.sleep(think_time_ms / 1000)

        method = (step.get("method") or "GET").upper()
        url = _render_template(step.get("url", ""), variables)
        headers = {
            k: _render_template(str(v), variables)
            for k, v in (step.get("headers") or {}).items()
        }
        body = step.get("body")
        if body is not None:
            body = _render_template(str(body), variables)

        step_start = time.monotonic()
        try:
            resp = http_requests.request(
                method=method,
                url=url,
                headers=headers,
                data=body,
                timeout=timeout,
                allow_redirects=True,
                verify=True,
            )
        except http_requests.Timeout:
            return CheckStatus.TIMEOUT, None, total_duration, f"Step {index} timed out"
        except Exception as exc:
            return CheckStatus.ERROR, None, total_duration, f"Step {index} failed: {exc}"

        step_duration = int((time.monotonic() - step_start) * 1000)
        total_duration += step_duration
        last_status_code = resp.status_code

        assertions = step.get("assert") or {}
        expected_status = assertions.get("status")
        if expected_status is not None and resp.status_code != expected_status:
            return (
                CheckStatus.FAILURE,
                resp.status_code,
                total_duration,
                f"Step {index} expected status {expected_status}, got {resp.status_code}",
            )

        body_contains = assertions.get("body_contains")
        if body_contains and body_contains not in resp.text:
            return (
                CheckStatus.FAILURE,
                resp.status_code,
                total_duration,
                f"Step {index} body does not contain '{body_contains}'",
            )

        for var_name, json_path in (step.get("extract") or {}).items():
            value = _extract_json_path(resp.text, json_path)
            if value is None:
                return (
                    CheckStatus.FAILURE,
                    resp.status_code,
                    total_duration,
                    f"Step {index} could not extract '{var_name}' from response",
                )
            variables[var_name] = str(value)

    return CheckStatus.SUCCESS, last_status_code, total_duration, ""


def _render_template(value: str, variables: dict[str, str]) -> str:
    result = value
    for key, val in variables.items():
        result = result.replace(f"{{{{{key}}}}}", val)
    return result


def _extract_json_path(body: str, path: str) -> str | None:
    try:
        data = json.loads(body)
    except json.JSONDecodeError:
        return None

    if path.startswith("$."):
        path = path[2:]
    current = data
    for part in path.split("."):
        if isinstance(current, dict) and part in current:
            current = current[part]
        else:
            return None
    if isinstance(current, (dict, list)):
        return json.dumps(current)
    return str(current)


def _run_heartbeat_check(monitor: Monitor) -> tuple[CheckStatus, int | None, int | None, str]:
    from django.utils import timezone

    grace = monitor.interval_seconds * 2
    if monitor.last_check_at is None:
        return CheckStatus.SUCCESS, None, None, ""
    age = (timezone.now() - monitor.last_check_at).total_seconds()
    if age > grace:
        return CheckStatus.FAILURE, None, None, f"No heartbeat for {int(age)}s (grace={grace}s)"
    return CheckStatus.SUCCESS, None, None, ""
