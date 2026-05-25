"""
Tenancy app — Tenant and Project models (minimal version for accounts).
Complete version will be implemented when working on §10 Multi-Tenancy.
"""
import uuid

from django.db import models


class Tenant(models.Model):
    """
    A tenant is a top-level organization. Everything (projects, users, monitors)
    belongs to a tenant. Tenant isolation is enforced via Row-Level Security.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200)
    slug = models.SlugField(max_length=100, unique=True)
    domain = models.CharField(max_length=255, blank=True, null=True)
    logo_url = models.URLField(blank=True, null=True)
    plan = models.CharField(max_length=50, default='free')
    data_region = models.CharField(max_length=20, default='us-east-1')
    status = models.CharField(
        max_length=20,
        default='active',
        choices=[
            ('active', 'Active'),
            ('suspended', 'Suspended'),
            ('deleted', 'Deleted'),
        ],
    )
    stripe_id = models.CharField(max_length=100, blank=True, null=True)
    settings = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'tenancy_tenant'
        ordering = ['-created_at']

    def __str__(self):
        return self.name


class Project(models.Model):
    """
    A project is a workspace within a tenant.
    A tenant can have multiple projects (e.g., 'staging', 'production').
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(
        'tenancy.Tenant',
        on_delete=models.CASCADE,
        related_name='projects',
    )
    name = models.CharField(max_length=200)
    slug = models.SlugField(max_length=100)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'tenancy_project'
        ordering = ['-created_at']
        constraints = [
            models.UniqueConstraint(
                fields=['tenant', 'slug'],
                name='unique_project_slug_per_tenant',
            ),
        ]

    def __str__(self):
        return f"{self.tenant.name} / {self.name}"