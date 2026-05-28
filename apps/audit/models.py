"""
Audit app — AuditLog (immutable, hash-chained), RetentionPolicy.

Maps to OneUptime document §7 (Compliance & Audit Logging) and §6 (Custom Retention).

Immutability is enforced at two levels:
  1. PostgreSQL RULE (applied in migration): prevents UPDATE and DELETE
  2. Model has no update methods — all access is append-only via AuditService
"""
import uuid

from django.db import models


class ActorType(models.TextChoices):
    USER = "user", "User"
    API_KEY = "api_key", "API Key"
    SYSTEM = "system", "System"
    SCIM = "scim", "SCIM"


class AuditLog(models.Model):
    """
    Immutable, append-only audit record.

    Every record contains a SHA-256 hash of its own content (record_hash)
    and the hash of the previous record (prev_hash), forming a tamper-evident chain.

    prev_hash of the very first record is '0' * 64.

    chain verification: AuditService.verify_chain(tenant)
    """
    # BigAutoField so id ordering matches insertion order (needed for chain)
    id = models.BigAutoField(primary_key=True)

    tenant = models.ForeignKey(
        "tenancy.Tenant",
        on_delete=models.CASCADE,
        related_name="audit_logs",
    )
    project = models.ForeignKey(
        "tenancy.Project",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="audit_logs",
    )

    actor_id = models.UUIDField()
    actor_type = models.CharField(max_length=20, choices=ActorType.choices)
    action = models.CharField(max_length=100, db_index=True)

    resource_type = models.CharField(max_length=50, blank=True, db_index=True)
    resource_id = models.UUIDField(null=True, blank=True)

    old_value = models.JSONField(null=True, blank=True)
    new_value = models.JSONField(null=True, blank=True)

    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)

    prev_hash = models.CharField(max_length=64)
    record_hash = models.CharField(max_length=64, db_index=True)

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        app_label = "audit"
        db_table = "audit_log"
        ordering = ["id"]
        indexes = [
            models.Index(fields=["tenant", "-created_at"]),
            models.Index(fields=["resource_type", "resource_id"]),
            models.Index(fields=["tenant", "action"]),
        ]

    def __str__(self):
        return f"[{self.id}] {self.action} by {self.actor_type}:{self.actor_id}"

    def save(self, *args, **kwargs):
        if self.pk:
            raise RuntimeError(
                "AuditLog records are immutable. Use AuditService.record() to create new entries."
            )
        super().save(*args, **kwargs)


class DataType(models.TextChoices):
    MONITOR_CHECKS = "monitor_checks", "Monitor Checks"
    AUDIT_LOGS = "audit_logs", "Audit Logs"
    WEBHOOK_DELIVERIES = "webhook_deliveries", "Webhook Deliveries"
    INCIDENTS_RESOLVED = "incidents_resolved", "Resolved Incidents"


class RetentionPolicy(models.Model):
    """
    Per-project data retention configuration.
    A background worker (purge_expired management command) enforces these policies daily.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(
        "tenancy.Tenant", on_delete=models.CASCADE, related_name="retention_policies"
    )
    project = models.ForeignKey(
        "tenancy.Project", on_delete=models.CASCADE, related_name="retention_policies"
    )
    data_type = models.CharField(max_length=30, choices=DataType.choices)
    retention_days = models.PositiveIntegerField(default=30)
    archive_to_s3 = models.BooleanField(default=False)
    s3_bucket = models.CharField(max_length=255, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = "audit"
        db_table = "audit_retention_policy"
        constraints = [
            models.UniqueConstraint(
                fields=["project", "data_type"],
                name="unique_retention_per_project_datatype",
            )
        ]

    def __str__(self):
        return f"{self.project.name} / {self.data_type}: {self.retention_days}d"
