"""
Monitoring app — Probe, Monitor, MonitorGroup, MonitorCheck.

Maps to OneUptime document §13 (API Endpoints: Monitoring).
"""
import uuid

from django.db import models


class MonitorType(models.TextChoices):
    API = "api", "API / HTTP"
    WEBSITE = "website", "Website"
    PING = "ping", "Ping (ICMP)"
    TCP = "tcp", "TCP Port"
    UDP = "udp", "UDP Port"
    DNS = "dns", "DNS"
    SSL = "ssl", "SSL Certificate"
    MULTI_STEP_API = "multi_step_api", "Multi-step API"
    JOURNEY = "journey", "User Journey"
    HEARTBEAT = "heartbeat", "Heartbeat"


class MonitorStatus(models.TextChoices):
    OPERATIONAL = "operational", "Operational"
    DEGRADED = "degraded", "Degraded"
    OFFLINE = "offline", "Offline"
    DISABLED = "disabled", "Disabled"


class CheckStatus(models.TextChoices):
    SUCCESS = "success", "Success"
    FAILURE = "failure", "Failure"
    TIMEOUT = "timeout", "Timeout"
    ERROR = "error", "Error"


class Probe(models.Model):
    """
    A probe is a monitoring agent that executes checks.
    For the PoC, 3 default probes are created per project (simulated locally).
    In production, probes are distributed agents authenticating via probe_key.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(
        "tenancy.Tenant", on_delete=models.CASCADE, related_name="probes"
    )
    project = models.ForeignKey(
        "tenancy.Project", on_delete=models.CASCADE, related_name="probes"
    )
    name = models.CharField(max_length=200)
    location = models.CharField(max_length=50)
    probe_key = models.CharField(max_length=64, unique=True, db_index=True)
    last_seen_at = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    version = models.CharField(max_length=20, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = "monitoring"
        db_table = "monitoring_probe"
        ordering = ["location"]
        indexes = [
            models.Index(fields=["tenant", "project"]),
        ]

    def __str__(self):
        return f"{self.name} ({self.location})"


class Monitor(models.Model):
    """
    A monitor defines what to check and how often.

    criteria example:
    {
      "response_status_code": {"operator": "equals", "value": 200},
      "response_body":        {"operator": "contains", "value": "ok"},
      "response_time_ms":     {"operator": "lt", "value": 2000}
    }
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(
        "tenancy.Tenant", on_delete=models.CASCADE, related_name="monitors"
    )
    project = models.ForeignKey(
        "tenancy.Project", on_delete=models.CASCADE, related_name="monitors"
    )
    team = models.ForeignKey(
        "rbac.Team",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="monitors",
        help_text="NULL = visible to all project members; set = team-scoped",
    )

    name = models.CharField(max_length=200)
    type = models.CharField(max_length=20, choices=MonitorType.choices, default=MonitorType.API)
    url = models.CharField(max_length=2048, blank=True)
    method = models.CharField(max_length=10, default="GET")
    interval_seconds = models.PositiveIntegerField(default=60)
    timeout_seconds = models.PositiveIntegerField(default=30)
    retries = models.PositiveSmallIntegerField(default=3)
    probe_locations = models.JSONField(default=list)
    criteria = models.JSONField(default=dict)
    steps = models.JSONField(
        default=list,
        blank=True,
        help_text="Ordered HTTP steps for multi_step_api and journey monitors.",
    )
    headers = models.JSONField(default=dict)
    body = models.TextField(blank=True)

    alert_on_failure = models.BooleanField(default=True)
    is_paused = models.BooleanField(default=False)
    status = models.CharField(
        max_length=20, choices=MonitorStatus.choices, default=MonitorStatus.OPERATIONAL
    )
    tags = models.JSONField(default=list)

    current_incident = models.ForeignKey(
        "incidents.Incident",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="active_monitors",
    )
    last_check_at = models.DateTimeField(null=True, blank=True)
    next_check_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = "monitoring"
        db_table = "monitoring_monitor"
        ordering = ["name"]
        indexes = [
            models.Index(fields=["tenant", "project"]),
            models.Index(fields=["status"]),
            models.Index(fields=["next_check_at"]),
            models.Index(fields=["tenant", "is_paused", "next_check_at"]),
        ]

    def __str__(self):
        return f"{self.name} ({self.type})"


class MonitorGroup(models.Model):
    """A logical grouping of monitors for display purposes."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(
        "tenancy.Tenant", on_delete=models.CASCADE, related_name="monitor_groups"
    )
    project = models.ForeignKey(
        "tenancy.Project", on_delete=models.CASCADE, related_name="monitor_groups"
    )
    team = models.ForeignKey(
        "rbac.Team",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="monitor_groups",
    )
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    monitors = models.ManyToManyField(Monitor, blank=True, related_name="groups")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = "monitoring"
        db_table = "monitoring_monitor_group"
        ordering = ["name"]
        indexes = [
            models.Index(fields=["tenant", "project"]),
        ]

    def __str__(self):
        return self.name


class MonitorCheck(models.Model):
    """
    Historical record of a single probe check execution.
    Partitioned logically by month; purged by retention policy.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(
        "tenancy.Tenant", on_delete=models.CASCADE, related_name="monitor_checks"
    )
    monitor = models.ForeignKey(Monitor, on_delete=models.CASCADE, related_name="checks")
    probe = models.ForeignKey(
        Probe, on_delete=models.SET_NULL, null=True, blank=True, related_name="checks"
    )

    checked_at = models.DateTimeField(db_index=True)
    status = models.CharField(max_length=20, choices=CheckStatus.choices)
    response_status_code = models.PositiveSmallIntegerField(null=True, blank=True)
    response_time_ms = models.PositiveIntegerField(null=True, blank=True)
    error_message = models.TextField(blank=True)

    triggered_incident = models.ForeignKey(
        "incidents.Incident",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="triggering_checks",
    )

    class Meta:
        app_label = "monitoring"
        db_table = "monitoring_monitor_check"
        ordering = ["-checked_at"]
        indexes = [
            models.Index(fields=["monitor", "-checked_at"]),
            models.Index(fields=["tenant", "-checked_at"]),
        ]

    def __str__(self):
        return f"{self.monitor.name} @ {self.checked_at} → {self.status}"
