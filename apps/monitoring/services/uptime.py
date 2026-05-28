"""
Uptime computation and status timeline services.
"""
from datetime import timedelta

from django.utils import timezone

from apps.monitoring.models import CheckStatus, Monitor, MonitorCheck, MonitorStatus


def compute_uptime(monitor: Monitor, since=None, until=None) -> dict | None:
    """
    Compute uptime percentage and check counts for a monitor over a time range.
    Returns None if no checks exist in the range.
    """
    if since is None:
        since = timezone.now() - timedelta(days=30)
    if until is None:
        until = timezone.now()

    checks = MonitorCheck.objects.filter(
        monitor=monitor,
        checked_at__gte=since,
        checked_at__lt=until,
    )
    total = checks.count()
    if total == 0:
        return None

    failed = checks.filter(
        status__in=[CheckStatus.FAILURE, CheckStatus.TIMEOUT, CheckStatus.ERROR]
    ).count()

    uptime_pct = ((total - failed) / total) * 100

    return {
        "uptime_percent": round(uptime_pct, 4),
        "total_checks": total,
        "failed_checks": failed,
        "successful_checks": total - failed,
        "period": {
            "from": since.isoformat(),
            "to": until.isoformat(),
        },
    }


def build_status_timeline(monitor: Monitor, since=None, until=None, bucket_minutes: int = 60) -> list:
    """
    Aggregate MonitorChecks into time buckets and return an ordered list of
    {start, end, status, checks_count, failed_count} intervals.

    bucket_minutes controls granularity:
      - Short ranges (<= 24h)  → 5-min buckets
      - Medium ranges (<= 7d)  → 60-min buckets
      - Long ranges (> 7d)     → 1-day buckets
    """
    if since is None:
        since = timezone.now() - timedelta(days=30)
    if until is None:
        until = timezone.now()

    duration = until - since
    if duration <= timedelta(hours=24):
        bucket_minutes = 5
    elif duration <= timedelta(days=7):
        bucket_minutes = 60
    else:
        bucket_minutes = 1440  # 1 day

    bucket_delta = timedelta(minutes=bucket_minutes)
    checks = (
        MonitorCheck.objects.filter(monitor=monitor, checked_at__gte=since, checked_at__lt=until)
        .order_by("checked_at")
        .values("checked_at", "status")
    )

    # Index checks into buckets
    buckets: dict = {}
    current = since
    while current < until:
        buckets[current] = {"total": 0, "failed": 0}
        current += bucket_delta

    bucket_starts = sorted(buckets.keys())

    for check in checks:
        ts = check["checked_at"]
        # Find the bucket this check belongs to
        bucket = since
        for bs in bucket_starts:
            if ts >= bs:
                bucket = bs
            else:
                break
        if bucket in buckets:
            buckets[bucket]["total"] += 1
            if check["status"] in (CheckStatus.FAILURE, CheckStatus.TIMEOUT, CheckStatus.ERROR):
                buckets[bucket]["failed"] += 1

    timeline = []
    for bucket_start in bucket_starts:
        data = buckets[bucket_start]
        bucket_end = bucket_start + bucket_delta

        if data["total"] == 0:
            bucket_status = "unknown"
        elif data["failed"] == 0:
            bucket_status = MonitorStatus.OPERATIONAL
        elif data["failed"] < data["total"]:
            bucket_status = MonitorStatus.DEGRADED
        else:
            bucket_status = MonitorStatus.OFFLINE

        timeline.append({
            "start": bucket_start.isoformat(),
            "end": bucket_end.isoformat(),
            "status": bucket_status,
            "checks_count": data["total"],
            "failed_count": data["failed"],
        })

    return timeline
