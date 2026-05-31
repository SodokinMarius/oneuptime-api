"""Serializers for RBAC resources: Role, Team, ApiKey."""
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.rbac.constants import ALL_PERMISSIONS
from apps.rbac.models import ApiKey, ResourcePolicy, Role, Team, TeamMembership


class RoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = ("id", "name", "description", "is_system", "permissions", "created_at", "updated_at")
        read_only_fields = ("id", "is_system", "created_at", "updated_at")

    def validate_permissions(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError("Permissions must be a list of strings.")
        for perm in value:
            if perm in ("*", "*:read", "*:create", "*:update", "*:delete"):
                continue
            parts = perm.split(":")
            if len(parts) != 2:
                raise serializers.ValidationError(
                    f"Invalid permission format '{perm}'. Expected 'resource:action'."
                )
            resource, action = parts
            if action != "*" and perm not in ALL_PERMISSIONS:
                raise serializers.ValidationError(
                    f"Unknown permission '{perm}'."
                )
        return value

    def validate(self, attrs):
        if self.instance and self.instance.is_system:
            raise serializers.ValidationError(
                "System roles cannot be modified. Create a custom role instead."
            )
        return attrs


class _NestedUserSerializer(serializers.Serializer):
    id        = serializers.UUIDField(source="user.id",         read_only=True)
    email     = serializers.EmailField(source="user.email",     read_only=True)
    full_name = serializers.CharField(source="user.full_name",  read_only=True)


class _NestedRoleSerializer(serializers.Serializer):
    id   = serializers.UUIDField(source="role.id",   read_only=True)
    name = serializers.CharField(source="role.name", read_only=True)


class TeamMemberSerializer(serializers.ModelSerializer):
    user       = _NestedUserSerializer(source="*", read_only=True)
    role       = _NestedRoleSerializer(source="*", read_only=True)
    granted_by = serializers.SerializerMethodField()

    class Meta:
        model = TeamMembership
        fields = ("id", "user", "role", "granted_by", "created_at")
        read_only_fields = fields

    def get_granted_by(self, obj):
        if obj.granted_by is None:
            return None
        return {"id": str(obj.granted_by.id), "email": obj.granted_by.email}


class AddTeamMemberSerializer(serializers.Serializer):
    email   = serializers.EmailField()
    role_id = serializers.UUIDField()


class TeamSerializer(serializers.ModelSerializer):
    member_count = serializers.SerializerMethodField()

    class Meta:
        model = Team
        fields = ("id", "name", "description", "member_count", "created_at", "updated_at")
        read_only_fields = ("id", "created_at", "updated_at")

    @extend_schema_field(serializers.IntegerField())
    def get_member_count(self, obj) -> int:
        return obj.memberships.count()


class ApiKeyCreateSerializer(serializers.Serializer):
    """Used only for creation — returns the raw key once."""
    name = serializers.CharField(max_length=200)
    permissions = serializers.ListField(
        child=serializers.CharField(), default=list
    )
    expires_at = serializers.DateTimeField(required=False, allow_null=True)


class ApiKeySerializer(serializers.ModelSerializer):
    is_active = serializers.BooleanField(read_only=True)

    class Meta:
        model = ApiKey
        fields = (
            "id", "name", "key_prefix", "permissions",
            "is_active", "last_used_at", "expires_at", "revoked_at",
            "created_at",
        )
        read_only_fields = (
            "id", "key_prefix", "is_active", "last_used_at",
            "revoked_at", "created_at",
        )


class ResourcePolicySerializer(serializers.ModelSerializer):
    role_name = serializers.CharField(source="role.name", read_only=True)
    effect_display = serializers.CharField(source="get_effect_display", read_only=True)

    class Meta:
        model = ResourcePolicy
        fields = (
            "id", "role", "role_name",
            "resource_type", "resource_id",
            "effect", "effect_display", "conditions",
            "created_at", "updated_at",
        )
        read_only_fields = ("id", "role_name", "effect_display", "created_at", "updated_at")

    def validate_effect(self, value):
        if value not in (ResourcePolicy.EFFECT_ALLOW, ResourcePolicy.EFFECT_DENY):
            raise serializers.ValidationError("effect must be 'allow' or 'deny'.")
        return value
