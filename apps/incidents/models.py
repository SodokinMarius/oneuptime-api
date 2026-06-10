"""
Incidents app — IncidentState, IncidentSeverity, Incident, IncidentNote, IncidentPostmortem.

Maps to OneUptime document §14 (API Endpoints: Incidents).
"""
import uuid

from django.db import models


class IncidentState(models.Model):
    """
    Custom incident states per project.
    System states (is_system=True) are created automatically and cannot be deleted.

    Default system states (in order):
      triggered → investigating → acknowledged → monitoring → resolved
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(
        "tenancy.Tenant", on_delete=models.CASCADE, related_name="incident_states"
    )
    project = models.ForeignKey(
        "tenancy.Project", on_delete=models.CASCADE, related_name="incident_states"
    )
    name = models.CharField(max_length=100)
    color = models.CharField(max_length=7, default="#6b7280")
    order = models.PositiveSmallIntegerField(default=0)
    is_resolved_state = models.BooleanField(default=False)
    is_system = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = "incidents"
        db_table = "incidents_state"
        ordering = ["order"]
        constraints = [
            models.UniqueConstraint(
                fields=["project", "name"], name="unique_incident_state_per_project"
            )
        ]

    def __str__(self):
        return f"{self.project.name} / {self.name}"


class IncidentSeverity(models.Model):
    """
    Custom incident severities per project.
    Default system severities: critical → high → medium → low → info
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(
        "tenancy.Tenant", on_delete=models.CASCADE, related_name="incident_severities"
    )
    project = models.ForeignKey(
        "tenancy.Project", on_delete=models.CASCADE, related_name="incident_severities"
    )
    name = models.CharField(max_length=100)
    color = models.CharField(max_length=7, default="#6b7280")
    order = models.PositiveSmallIntegerField(default=0)
    is_system = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = "incidents"
        db_table = "incidents_severity"
        ordering = ["order"]
        constraints = [
            models.UniqueConstraint(
                fields=["project", "name"], name="unique_incident_severity_per_project"
            )
        ]

    def __str__(self):
        return f"{self.project.name} / {self.name}"


class Incident(models.Model):
    """
    An incident represents a service disruption (auto-triggered or manual).
    Lifecycle: triggered → acknowledged → resolved (via custom states).
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(
        "tenancy.Tenant", on_delete=models.CASCADE, related_name="incidents"
    )
    project = models.ForeignKey(
        "tenancy.Project", on_delete=models.CASCADE, related_name="incidents"
    )
    team = models.ForeignKey(
        "rbac.Team",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="incidents",
    )
    monitor = models.ForeignKey(
        "monitoring.Monitor",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="incidents",
    )

    title = models.CharField(max_length=500)
    description = models.TextField(blank=True)
    severity = models.ForeignKey(
        IncidentSeverity,
        on_delete=models.PROTECT,
        related_name="incidents",
    )
    state = models.ForeignKey(
        IncidentState,
        on_delete=models.PROTECT,
        related_name="incidents",
    )
    assigned_to = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_incidents",
    )

    triggered_at = models.DateTimeField(auto_now_add=True)
    acknowledged_at = models.DateTimeField(null=True, blank=True)
    acknowledged_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="acknowledged_incidents",
    )
    resolved_at = models.DateTimeField(null=True, blank=True)
    resolved_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="resolved_incidents",
    )

    is_visible_on_status_page = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = "incidents"
        db_table = "incidents_incident"
        ordering = ["-triggered_at"]
        indexes = [
            models.Index(fields=["tenant", "project"]),
            models.Index(fields=["tenant", "-triggered_at"]),
            models.Index(fields=["monitor"]),
        ]

    def __str__(self):
        return self.title

    @property
    def is_resolved(self) -> bool:
        return self.state.is_resolved_state if self.state_id else False


class IncidentNote(models.Model):
    """An internal or public note on an incident timeline."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(
        "tenancy.Tenant", on_delete=models.CASCADE, related_name="incident_notes"
    )
    incident = models.ForeignKey(Incident, on_delete=models.CASCADE, related_name="notes")
    author = models.ForeignKey(
        "accounts.User", on_delete=models.SET_NULL, null=True, related_name="incident_notes"
    )
    content = models.TextField()
    is_public = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = "incidents"
        db_table = "incidents_note"
        ordering = ["created_at"]
        indexes = [
            models.Index(fields=["incident", "created_at"]),
        ]

    def __str__(self):
        return f"Note on {self.incident.title} by {self.author}"


class IncidentPostmortem(models.Model):
    """Post-incident analysis, one per incident."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(
        "tenancy.Tenant", on_delete=models.CASCADE, related_name="postmortems"
    )
    incident = models.OneToOneField(
        Incident, on_delete=models.CASCADE, related_name="postmortem"
    )
    summary = models.TextField(blank=True)
    impact = models.TextField(blank=True)
    root_cause = models.TextField(blank=True)
    timeline = models.TextField(blank=True)
    action_items = models.JSONField(default=list)
    published_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = "incidents"
        db_table = "incidents_postmortem"

    def __str__(self):
        return f"Postmortem: {self.incident.title}"
