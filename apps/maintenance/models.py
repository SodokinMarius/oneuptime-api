"""
Maintenance app — ScheduledMaintenance.

Maps to OneUptime document §18 (API Endpoints: Workflows & Automations).
"""
import uuid

from django.db import models


class MaintenanceStatus(models.TextChoices):
    SCHEDULED = "scheduled", "Scheduled"
    IN_PROGRESS = "in_progress", "In Progress"
    COMPLETED = "completed", "Completed"
    CANCELLED = "cancelled", "Cancelled"


class ScheduledMaintenance(models.Model):
    """
    A planned maintenance window that affects one or more monitors.
    Suppresses alerts and updates status page during the window.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(
        "tenancy.Tenant", on_delete=models.CASCADE, related_name="scheduled_maintenances"
    )
    project = models.ForeignKey(
        "tenancy.Project", on_delete=models.CASCADE, related_name="scheduled_maintenances"
    )
    team = models.ForeignKey(
        "rbac.Team",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="scheduled_maintenances",
    )

    title = models.CharField(max_length=500)
    description = models.TextField(blank=True)
    starts_at = models.DateTimeField(db_index=True)
    ends_at = models.DateTimeField(db_index=True)
    monitors = models.ManyToManyField(
        "monitoring.Monitor", blank=True, related_name="scheduled_maintenances"
    )
    status = models.CharField(
        max_length=20,
        choices=MaintenanceStatus.choices,
        default=MaintenanceStatus.SCHEDULED,
        db_index=True,
    )
    is_visible_on_status_page = models.BooleanField(default=True)
    notify_subscribers = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = "maintenance"
        db_table = "maintenance_scheduled"
        ordering = ["-starts_at"]
        indexes = [
            models.Index(fields=["tenant", "project"]),
            models.Index(fields=["status", "starts_at"]),
        ]

    def __str__(self):
        return self.title
