"""
Status Pages app — StatusPage, StatusPageResource, StatusPageSubscriber, StatusPageAnnouncement.

Maps to OneUptime document §15 (API Endpoints: Status Pages).
"""
import uuid

from django.db import models


class StatusPage(models.Model):
    """A public (or private) status page for a project."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(
        "tenancy.Tenant", on_delete=models.CASCADE, related_name="status_pages"
    )
    project = models.ForeignKey(
        "tenancy.Project", on_delete=models.CASCADE, related_name="status_pages"
    )

    name = models.CharField(max_length=200)
    slug = models.SlugField(max_length=100)
    is_public = models.BooleanField(default=True)
    custom_domain = models.CharField(max_length=255, blank=True, null=True)
    logo_url = models.URLField(blank=True, null=True)
    primary_color = models.CharField(max_length=7, default="#0066cc")
    custom_css = models.TextField(blank=True)
    description = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = "status_pages"
        db_table = "status_pages_page"
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(
                fields=["tenant", "slug"], name="unique_status_page_slug_per_tenant"
            )
        ]
        indexes = [
            models.Index(fields=["tenant", "project"]),
        ]

    def __str__(self):
        return self.name


class StatusPageResource(models.Model):
    """
    A monitor or monitor group displayed on a status page.
    Exactly one of monitor/monitor_group must be set.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(
        "tenancy.Tenant", on_delete=models.CASCADE, related_name="status_page_resources"
    )
    status_page = models.ForeignKey(
        StatusPage, on_delete=models.CASCADE, related_name="resources"
    )
    monitor = models.ForeignKey(
        "monitoring.Monitor",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="status_page_resources",
    )
    monitor_group = models.ForeignKey(
        "monitoring.MonitorGroup",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="status_page_resources",
    )
    display_name = models.CharField(max_length=200, blank=True)
    order = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        app_label = "status_pages"
        db_table = "status_pages_resource"
        ordering = ["order"]
        indexes = [
            models.Index(fields=["status_page", "order"]),
        ]

    def __str__(self):
        label = self.display_name or (self.monitor.name if self.monitor else "group")
        return f"{self.status_page.name} / {label}"


class StatusPageSubscriber(models.Model):
    """Email subscriber for status page notifications."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(
        "tenancy.Tenant", on_delete=models.CASCADE, related_name="status_page_subscribers"
    )
    status_page = models.ForeignKey(
        StatusPage, on_delete=models.CASCADE, related_name="subscribers"
    )
    email = models.EmailField()
    is_verified = models.BooleanField(default=False)
    verification_token = models.CharField(max_length=64, blank=True)
    subscribed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        app_label = "status_pages"
        db_table = "status_pages_subscriber"
        constraints = [
            models.UniqueConstraint(
                fields=["status_page", "email"], name="unique_subscriber_per_page"
            )
        ]

    def __str__(self):
        return f"{self.email} → {self.status_page.name}"


class StatusPageAnnouncement(models.Model):
    """A time-bounded announcement displayed on a status page."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(
        "tenancy.Tenant", on_delete=models.CASCADE, related_name="status_page_announcements"
    )
    status_page = models.ForeignKey(
        StatusPage, on_delete=models.CASCADE, related_name="announcements"
    )
    title = models.CharField(max_length=500)
    content = models.TextField()
    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = "status_pages"
        db_table = "status_pages_announcement"
        ordering = ["-starts_at"]
        indexes = [
            models.Index(fields=["status_page", "is_active"]),
        ]

    def __str__(self):
        return f"{self.status_page.name}: {self.title}"
