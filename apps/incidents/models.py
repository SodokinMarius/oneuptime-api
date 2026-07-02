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


class EscalationPolicy(models.Model):
    """Multi-step escalation when an incident is not acknowledged in time."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(
        "tenancy.Tenant", on_delete=models.CASCADE, related_name="escalation_policies"
    )
    project = models.ForeignKey(
        "tenancy.Project", on_delete=models.CASCADE, related_name="escalation_policies"
    )
    team = models.ForeignKey(
        "rbac.Team",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="escalation_policies",
    )
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    is_default = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    severity_names = models.JSONField(
        default=list,
        blank=True,
        help_text="Empty = all severities; otherwise list of severity names.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = "incidents"
        db_table = "incidents_escalation_policy"
        ordering = ["name"]
        indexes = [
            models.Index(fields=["tenant", "project"]),
        ]

    def __str__(self):
        return f"{self.project.name} / {self.name}"


class EscalationStep(models.Model):
    """One step in an escalation policy — executed after delay_minutes from trigger/previous step."""

    class Action(models.TextChoices):
        NOTIFY_WEBHOOK = "notify_webhook", "Notify webhook"
        NOTIFY_USER = "notify_user", "Notify user"
        INCREASE_SEVERITY = "increase_severity", "Increase severity"
        ASSIGN_USER = "assign_user", "Assign user"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    policy = models.ForeignKey(
        EscalationPolicy, on_delete=models.CASCADE, related_name="steps"
    )
    order = models.PositiveSmallIntegerField(default=1)
    delay_minutes = models.PositiveIntegerField(
        default=15,
        help_text="Minutes after incident trigger (step 1) or previous step.",
    )
    action = models.CharField(max_length=30, choices=Action.choices)
    webhook = models.ForeignKey(
        "webhooks.Webhook",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="escalation_steps",
    )
    user = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="escalation_steps",
    )
    target_severity = models.ForeignKey(
        IncidentSeverity,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="escalation_steps",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        app_label = "incidents"
        db_table = "incidents_escalation_step"
        ordering = ["order"]
        constraints = [
            models.UniqueConstraint(
                fields=["policy", "order"], name="unique_escalation_step_order"
            )
        ]

    def __str__(self):
        return f"{self.policy.name} step {self.order}"


class IncidentEscalationState(models.Model):
    """Tracks escalation progress for an open incident."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    incident = models.OneToOneField(
        Incident, on_delete=models.CASCADE, related_name="escalation_state"
    )
    policy = models.ForeignKey(
        EscalationPolicy, on_delete=models.CASCADE, related_name="incident_states"
    )
    current_step_order = models.PositiveSmallIntegerField(default=0)
    last_escalated_at = models.DateTimeField(null=True, blank=True)
    completed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = "incidents"
        db_table = "incidents_escalation_state"

    def __str__(self):
        return f"Escalation for {self.incident.title}"


class IncidentWorkflowRule(models.Model):
    """Event-driven automation rules for incidents."""

    class Trigger(models.TextChoices):
        INCIDENT_CREATED = "incident_created", "Incident created"
        INCIDENT_UNACKNOWLEDGED = "incident_unacknowledged", "Incident unacknowledged"
        INCIDENT_RESOLVED = "incident_resolved", "Incident resolved"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(
        "tenancy.Tenant", on_delete=models.CASCADE, related_name="incident_workflow_rules"
    )
    project = models.ForeignKey(
        "tenancy.Project", on_delete=models.CASCADE, related_name="incident_workflow_rules"
    )
    name = models.CharField(max_length=200)
    trigger = models.CharField(max_length=40, choices=Trigger.choices)
    conditions = models.JSONField(
        default=dict,
        blank=True,
        help_text='e.g. {"severity_names": ["critical"], "delay_minutes": 15}',
    )
    actions = models.JSONField(
        default=list,
        help_text='List of {"type": "webhook"|"assign"|"notify_user", ...}',
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = "incidents"
        db_table = "incidents_workflow_rule"
        ordering = ["name"]
        indexes = [
            models.Index(fields=["tenant", "project", "trigger"]),
        ]

    def __str__(self):
        return f"{self.project.name} / {self.name}"
