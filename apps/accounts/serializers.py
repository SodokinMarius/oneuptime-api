"""
Serializers for accounts app.
"""
from django.contrib.auth import authenticate, password_validation
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from apps.accounts.models import User, UserMembership


class UserSerializer(serializers.ModelSerializer):
    """Public representation of a User."""
    full_name = serializers.CharField(read_only=True)
    tenant = serializers.SerializerMethodField()
    default_project = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            'id', 'email', 'first_name', 'last_name', 'full_name',
            'is_active', 'is_email_verified', 'mfa_enabled',
            'session_timeout_minutes', 'tenant', 'default_project',
            'created_at', 'updated_at',
        )
        read_only_fields = (
            'id', 'email', 'is_active', 'is_email_verified',
            'created_at', 'updated_at',
        )

    def get_tenant(self, user):
        membership = self._owner_membership(user)
        if membership is None:
            return None
        t = membership.tenant
        return {"id": str(t.id), "name": t.name, "slug": t.slug}

    def get_default_project(self, user):
        from apps.tenancy.models import Project
        membership = self._owner_membership(user)
        if membership is None:
            return None
        project = (
            Project.objects.filter(tenant=membership.tenant, is_active=True)
            .order_by("created_at")
            .first()
        )
        if project is None:
            return None
        return {"id": str(project.id), "name": project.name, "slug": project.slug}

    @staticmethod
    def _owner_membership(user):
        membership = (
            UserMembership.objects.filter(
                user=user, is_owner=True, accepted_at__isnull=False,
            )
            .select_related("tenant")
            .first()
        )
        if membership is None:
            membership = (
                UserMembership.objects.filter(
                    user=user, accepted_at__isnull=False,
                )
                .select_related("tenant")
                .first()
            )
        return membership


class UserUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating user profile (limited fields)."""
    class Meta:
        model = User
        fields = ('first_name', 'last_name', 'session_timeout_minutes')


class RegisterSerializer(serializers.Serializer):
    """Registration: creates User + Tenant + Project."""
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)
    first_name = serializers.CharField(required=False, allow_blank=True, max_length=150)
    last_name = serializers.CharField(required=False, allow_blank=True, max_length=150)
    tenant_name = serializers.CharField(max_length=200)

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value.lower()

    def validate_password(self, value):
        try:
            password_validation.validate_password(value)
        except DjangoValidationError as e:
            raise serializers.ValidationError(list(e.messages))
        return value


class LoginSerializer(serializers.Serializer):
    """Login with email + password."""
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        email = attrs['email'].lower()
        pending = User.objects.filter(email=email, is_email_verified=False).exists()
        if pending:
            raise serializers.ValidationError(
                "Please activate your account via the email OTP.",
                code='account_not_activated',
            )

        user = authenticate(
            request=self.context.get('request'),
            username=email,
            password=attrs['password'],
        )
        if not user:
            raise serializers.ValidationError(
                "Invalid email or password.",
                code='authorization',
            )
        if not user.is_active:
            raise serializers.ValidationError(
                "Account is disabled.",
                code='authorization',
            )
        attrs['user'] = user
        return attrs


class ActivateAccountSerializer(serializers.Serializer):
    email = serializers.EmailField()
    code = serializers.CharField(min_length=4, max_length=8)

    def validate_email(self, value):
        return value.lower()


class ResendActivationSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate_email(self, value):
        return value.lower()


class MfaVerifyLoginSerializer(serializers.Serializer):
    mfa_token = serializers.CharField()
    code = serializers.CharField(min_length=6, max_length=8)


class MfaSetupConfirmSerializer(serializers.Serializer):
    code = serializers.CharField(min_length=6, max_length=8)


class MfaDisableSerializer(serializers.Serializer):
    password = serializers.CharField(write_only=True)
    code = serializers.CharField(min_length=6, max_length=8)

    def validate_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError('Password is incorrect.')
        return value


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate_email(self, value):
        return value.lower()


class PasswordResetConfirmSerializer(serializers.Serializer):
    email = serializers.EmailField()
    code = serializers.CharField(min_length=4, max_length=8)
    new_password = serializers.CharField(write_only=True, min_length=8)

    def validate_email(self, value):
        return value.lower()

    def validate_new_password(self, value):
        try:
            password_validation.validate_password(value)
        except DjangoValidationError as e:
            raise serializers.ValidationError(list(e.messages))
        return value


class TokenVerifySerializer(serializers.Serializer):
    token = serializers.CharField()


class ChangePasswordSerializer(serializers.Serializer):
    """Change password."""
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=8)

    def validate_old_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError("Old password is incorrect.")
        return value

    def validate_new_password(self, value):
        try:
            password_validation.validate_password(value, user=self.context['request'].user)
        except DjangoValidationError as e:
            raise serializers.ValidationError(list(e.messages))
        return value


class InviteUserSerializer(serializers.Serializer):
    """Invite a user to the current tenant by email."""
    email = serializers.EmailField()
    first_name = serializers.CharField(required=False, allow_blank=True, max_length=150)
    last_name = serializers.CharField(required=False, allow_blank=True, max_length=150)


class AcceptInviteSerializer(serializers.Serializer):
    """Accept an invitation to join a tenant."""
    token = serializers.CharField()
    email = serializers.EmailField()
    # Password is required only for new users who don't have one yet
    password = serializers.CharField(write_only=True, min_length=8, required=False, allow_blank=True)

    def validate_email(self, value):
        return value.lower()

    def validate_password(self, value):
        if value:
            try:
                password_validation.validate_password(value)
            except DjangoValidationError as e:
                raise serializers.ValidationError(list(e.messages))
        return value


class UserMembershipSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    is_accepted = serializers.BooleanField(read_only=True)

    class Meta:
        model = UserMembership
        fields = (
            'id', 'user', 'is_owner', 'invited_at',
            'accepted_at', 'is_accepted', 'created_at',
        )
        read_only_fields = fields