"""Serializers for SSO configuration management."""
from rest_framework import serializers

from apps.rbac.models import Role, Team
from apps.sso.models import SCIMSyncLog, SSOConfig, SSOProvider


class SSOConfigSerializer(serializers.ModelSerializer):
    default_role_id = serializers.PrimaryKeyRelatedField(
        source="default_role",
        queryset=Role.objects.all(),
        required=False,
        allow_null=True,
    )
    default_team_ids = serializers.PrimaryKeyRelatedField(
        source="default_teams",
        many=True,
        queryset=Team.objects.all(),
        required=False,
    )
    sp_metadata = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = SSOConfig
        fields = [
            "id",
            "provider",
            "name",
            "description",
            "entity_id",
            "sso_url",
            "slo_url",
            "x509_cert",
            "attribute_map",
            "jit_enabled",
            "default_role_id",
            "default_team_ids",
            "enforce_sso",
            "scim_auto_provision",
            "scim_auto_deprovision",
            "scim_enable_push_groups",
            "is_enabled",
            "sp_metadata",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "sp_metadata"]
        extra_kwargs = {
            "x509_cert": {"write_only": True},
        }

    def get_sp_metadata(self, obj: SSOConfig) -> dict:
        from apps.sso.services.saml import SAMLService
        return SAMLService(obj).sp_info()

    def validate_default_team_ids(self, teams):
        project = self.context.get("project")
        if project and teams:
            for team in teams:
                if team.project_id != project.id:
                    raise serializers.ValidationError(
                        f"Team {team.name} does not belong to this project."
                    )
        return teams

    def validate_default_role_id(self, role):
        project = self.context.get("project")
        if role and project and role.project_id != project.id:
            raise serializers.ValidationError("Role does not belong to this project.")
        return role


class SSOConfigCreateSerializer(SSOConfigSerializer):
    """On create, return the SCIM token once."""

    scim_token = serializers.CharField(read_only=True)

    class Meta(SSOConfigSerializer.Meta):
        fields = SSOConfigSerializer.Meta.fields + ["scim_token"]


class SSOConfigDetailSerializer(SSOConfigCreateSerializer):
    """Full detail including masked SCIM token."""

    scim_token_prefix = serializers.SerializerMethodField()

    class Meta(SSOConfigCreateSerializer.Meta):
        fields = SSOConfigCreateSerializer.Meta.fields + ["scim_token_prefix"]

    def get_scim_token_prefix(self, obj: SSOConfig) -> str:
        token = obj.scim_token or ""
        return f"{token[:8]}..." if len(token) > 8 else ""


class SCIMSyncLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = SCIMSyncLog
        fields = [
            "id", "operation", "resource", "external_id",
            "payload", "status", "error_message", "created_at",
        ]
        read_only_fields = fields


class SSODiscoverSerializer(serializers.Serializer):
    email = serializers.EmailField()


class ProviderPresetSerializer(serializers.Serializer):
    """IdP preset hints for common providers."""
    provider = serializers.ChoiceField(choices=SSOProvider.choices)
    attribute_map = serializers.DictField(read_only=True)


PROVIDER_PRESETS = {
    SSOProvider.OKTA: {
        "attribute_map": {
            "email": "email",
            "first_name": "firstName",
            "last_name": "lastName",
        },
    },
    SSOProvider.AZURE_AD: {
        "attribute_map": {
            "email": "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
            "first_name": "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname",
            "last_name": "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname",
            "display_name": "http://schemas.microsoft.com/identity/claims/displayname",
        },
    },
    SSOProvider.GOOGLE: {
        "attribute_map": {
            "email": "email",
            "first_name": "first_name",
            "last_name": "last_name",
        },
    },
}
