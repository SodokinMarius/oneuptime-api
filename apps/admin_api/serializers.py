"""Serializers for admin_api (super-admin views)."""
from rest_framework import serializers

from apps.tenancy.models import Tenant, Project


class AdminTenantSerializer(serializers.ModelSerializer):
    projects_count = serializers.SerializerMethodField()
    members_count = serializers.SerializerMethodField()

    class Meta:
        model = Tenant
        fields = (
            "id", "name", "slug", "domain", "logo_url",
            "plan", "data_region", "status", "settings", "stripe_id",
            "projects_count", "members_count",
            "created_at", "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")

    def get_projects_count(self, obj) -> int:
        return obj.projects.count()

    def get_members_count(self, obj) -> int:
        return obj.memberships.filter(accepted_at__isnull=False).count()


class AdminTenantUpdateSerializer(serializers.ModelSerializer):
    """Restricted update — only plan, status, settings, stripe_id."""
    class Meta:
        model = Tenant
        fields = ("plan", "data_region", "status", "settings", "stripe_id")


class AdminTenantUsageSerializer(serializers.Serializer):
    tenant_id = serializers.UUIDField()
    monitors = serializers.IntegerField()
    active_incidents = serializers.IntegerField()
    members = serializers.IntegerField()
    webhooks = serializers.IntegerField()
    pending_deliveries = serializers.IntegerField()
    audit_log_entries = serializers.IntegerField()
