"""Serializers for tenancy resources."""
from rest_framework import serializers

from apps.tenancy.models import Project, Tenant


class ProjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Project
        fields = (
            "id", "name", "slug", "description",
            "is_active", "created_at", "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")

    def validate_slug(self, value):
        tenant = None
        request = self.context.get("request")
        if request:
            tenant = getattr(request, "tenant", None)

        qs = Project.objects.filter(tenant=tenant, slug=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError(
                "A project with this slug already exists in this tenant."
            )
        return value


class TenantSerializer(serializers.ModelSerializer):
    projects_count = serializers.SerializerMethodField()

    class Meta:
        model = Tenant
        fields = (
            "id", "name", "slug", "domain", "logo_url",
            "plan", "data_region", "status", "settings",
            "projects_count", "created_at", "updated_at",
        )
        read_only_fields = ("id", "stripe_id", "created_at", "updated_at")

    def get_projects_count(self, obj) -> int:
        return obj.projects.filter(is_active=True).count()


class TenantDetailSerializer(TenantSerializer):
    """Extended serializer with nested projects list — used on retrieve."""
    projects = ProjectSerializer(many=True, read_only=True)

    class Meta(TenantSerializer.Meta):
        fields = TenantSerializer.Meta.fields + ("projects",)
