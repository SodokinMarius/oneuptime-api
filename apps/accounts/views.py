"""
Views for accounts app - authentication and user management.
"""
from django.contrib.auth import get_user_model
from django.utils import timezone
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenRefreshView, TokenVerifyView

from apps.accounts.models import OtpPurpose, UserMembership
from apps.accounts.serializers import (
    AcceptInviteSerializer,
    ActivateAccountSerializer,
    ChangePasswordSerializer,
    InviteUserSerializer,
    LoginSerializer,
    MfaDisableSerializer,
    MfaSetupConfirmSerializer,
    MfaVerifyLoginSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    RegisterSerializer,
    ResendActivationSerializer,
    UserMembershipSerializer,
    UserSerializer,
    UserUpdateSerializer,
)
from apps.accounts.exceptions import OtpError
from apps.accounts.services.email import AuthEmailService
from apps.accounts.services.mfa import MfaService
from apps.accounts.services.onboarding import OnboardingService
from apps.accounts.services.otp import OtpService
from apps.accounts.utils import otp_error_response

User = get_user_model()


def _issue_tokens(user):
    """Generate access + refresh tokens for a user."""
    refresh = RefreshToken.for_user(user)
    return {
        'access': str(refresh.access_token),
        'refresh': str(refresh),
    }


def _client_ip(request):
    """Extract client IP, handling reverse proxy headers."""
    xff = request.META.get('HTTP_X_FORWARDED_FOR')
    if xff:
        return xff.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR')


# ---------------------------------------------------------------------------
# Auth endpoints
# ---------------------------------------------------------------------------

class RegisterView(APIView):
    """Register a new user. Creates User + Tenant + Project atomically."""
    permission_classes = [AllowAny]
    serializer_class = RegisterSerializer

    @extend_schema(
        tags=['Auth'],
        request=RegisterSerializer,
        responses={201: OpenApiResponse(description='Account created, returns user + tokens')},
        summary='Register a new user and tenant',
    )
    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user, tenant, project = OnboardingService.create_account(
            email=serializer.validated_data['email'],
            password=serializer.validated_data['password'],
            tenant_name=serializer.validated_data['tenant_name'],
            first_name=serializer.validated_data.get('first_name', ''),
            last_name=serializer.validated_data.get('last_name', ''),
        )

        _, code = OtpService.create_challenge(user, OtpPurpose.ACTIVATION)
        AuthEmailService.send_activation_otp(user.email, code)

        return Response({
            'detail': 'Account created. Check your email for the activation OTP.',
            'user': UserSerializer(user).data,
            'tenant': {
                'id': str(tenant.id),
                'name': tenant.name,
                'slug': tenant.slug,
            },
            'project': {
                'id': str(project.id),
                'name': project.name,
                'slug': project.slug,
            },
        }, status=status.HTTP_201_CREATED)


class LoginView(APIView):
    """Authenticate with email + password and receive JWT tokens."""
    permission_classes = [AllowAny]
    serializer_class = LoginSerializer

    @extend_schema(
        tags=['Auth'],
        request=LoginSerializer,
        responses={200: OpenApiResponse(description='Login successful, returns tokens')},
        summary='Login with email and password',
    )
    def post(self, request):
        serializer = LoginSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']

        # Update last login info
        user.last_login = timezone.now()
        user.last_login_ip = _client_ip(request)
        user.save(update_fields=['last_login', 'last_login_ip'])

        if user.mfa_enabled:
            session = MfaService.create_login_session(user)
            return Response({
                'mfa_required': True,
                'mfa_token': session.token,
                'expires_in': int(
                    (session.expires_at - timezone.now()).total_seconds()
                ),
            })

        tokens = _issue_tokens(user)
        return Response({
            'user': UserSerializer(user).data,
            **tokens,
        })


class ActivateAccountView(APIView):
    """Verify email OTP and activate account."""
    permission_classes = [AllowAny]
    serializer_class = ActivateAccountSerializer

    @extend_schema(
        tags=['Auth'],
        request=ActivateAccountSerializer,
        responses={200: OpenApiResponse(description='Account activated, returns tokens')},
        summary='Activate account with email OTP',
    )
    def post(self, request):
        serializer = ActivateAccountSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email']
        code = serializer.validated_data['code']

        user = User.objects.filter(email=email).first()
        if not user:
            return Response(
                {'detail': 'Invalid email or OTP code.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if user.is_email_verified:
            return Response({'detail': 'Account is already activated.'})

        try:
            OtpService.verify(user, OtpPurpose.ACTIVATION, code)
        except OtpError as exc:
            return otp_error_response(exc)

        user.is_active = True
        user.is_email_verified = True
        user.save(update_fields=['is_active', 'is_email_verified'])

        tokens = _issue_tokens(user)
        return Response({
            'detail': 'Account activated successfully.',
            'user': UserSerializer(user).data,
            **tokens,
        })


class ResendActivationView(APIView):
    """Resend activation OTP email."""
    permission_classes = [AllowAny]
    serializer_class = ResendActivationSerializer

    @extend_schema(
        tags=['Auth'],
        request=ResendActivationSerializer,
        responses={200: OpenApiResponse(description='OTP sent if account exists')},
        summary='Resend activation OTP',
    )
    def post(self, request):
        serializer = ResendActivationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email']

        user = User.objects.filter(email=email, is_email_verified=False).first()
        if user:
            _, code = OtpService.create_challenge(user, OtpPurpose.ACTIVATION)
            AuthEmailService.send_activation_otp(user.email, code)

        return Response({
            'detail': (
                'Si un compte non vérifié existe, un nouveau code a été envoyé. '
                'Les anciens codes sont invalidés.'
            ),
        })


class MfaVerifyLoginView(APIView):
    """Complete login after MFA (TOTP)."""
    permission_classes = [AllowAny]
    serializer_class = MfaVerifyLoginSerializer

    @extend_schema(
        tags=['Auth'],
        request=MfaVerifyLoginSerializer,
        responses={200: OpenApiResponse(description='Login complete, returns tokens')},
        summary='Verify MFA and receive JWT tokens',
    )
    def post(self, request):
        serializer = MfaVerifyLoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            session = MfaService.consume_login_session(
                serializer.validated_data['mfa_token']
            )
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        user = session.user
        if not MfaService.verify_code(
            user.mfa_secret,
            serializer.validated_data['code'],
        ):
            return Response(
                {'detail': 'Invalid MFA code.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.last_login = timezone.now()
        user.last_login_ip = _client_ip(request)
        user.save(update_fields=['last_login', 'last_login_ip'])

        tokens = _issue_tokens(user)
        return Response({
            'user': UserSerializer(user).data,
            **tokens,
        })


class MfaSetupResponseSerializer(serializers.Serializer):
    secret = serializers.CharField()
    provisioning_uri = serializers.CharField()


class MfaSetupView(APIView):
    """Start MFA setup — returns TOTP secret and provisioning URI."""
    permission_classes = [IsAuthenticated]
    serializer_class = MfaSetupResponseSerializer

    @extend_schema(
        tags=['Auth'],
        responses={200: MfaSetupResponseSerializer},
        summary='Start MFA (TOTP) setup',
    )
    def post(self, request):
        secret = MfaService.generate_secret()
        request.user.mfa_secret = secret
        request.user.mfa_enabled = False
        request.user.save(update_fields=['mfa_secret', 'mfa_enabled'])

        return Response({
            'secret': secret,
            'provisioning_uri': MfaService.provisioning_uri(request.user, secret),
        })


class MfaConfirmView(APIView):
    """Confirm MFA setup with a valid TOTP code."""
    permission_classes = [IsAuthenticated]
    serializer_class = MfaSetupConfirmSerializer

    @extend_schema(
        tags=['Auth'],
        request=MfaSetupConfirmSerializer,
        responses={200: OpenApiResponse(description='MFA enabled')},
        summary='Confirm MFA setup',
    )
    def post(self, request):
        serializer = MfaSetupConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        if not request.user.mfa_secret:
            return Response(
                {'detail': 'Call /auth/mfa/setup first.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not MfaService.verify_code(
            request.user.mfa_secret,
            serializer.validated_data['code'],
        ):
            return Response(
                {'detail': 'Invalid MFA code.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        request.user.mfa_enabled = True
        request.user.save(update_fields=['mfa_enabled'])
        return Response({'detail': 'MFA enabled successfully.'})


class MfaDisableView(APIView):
    """Disable MFA (requires password + current TOTP)."""
    permission_classes = [IsAuthenticated]
    serializer_class = MfaDisableSerializer

    @extend_schema(
        tags=['Auth'],
        request=MfaDisableSerializer,
        responses={204: OpenApiResponse(description='MFA disabled')},
        summary='Disable MFA',
    )
    def post(self, request):
        serializer = MfaDisableSerializer(
            data=request.data, context={'request': request}
        )
        serializer.is_valid(raise_exception=True)

        if not MfaService.verify_code(
            request.user.mfa_secret,
            serializer.validated_data['code'],
        ):
            return Response(
                {'detail': 'Invalid MFA code.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        request.user.mfa_enabled = False
        request.user.mfa_secret = ''
        request.user.save(update_fields=['mfa_enabled', 'mfa_secret'])
        return Response(status=status.HTTP_204_NO_CONTENT)


class PasswordResetRequestView(APIView):
    """Request password reset OTP by email."""
    permission_classes = [AllowAny]
    serializer_class = PasswordResetRequestSerializer

    @extend_schema(
        tags=['Auth'],
        request=PasswordResetRequestSerializer,
        responses={200: OpenApiResponse(description='OTP sent if account exists')},
        summary='Request password reset OTP',
    )
    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email']

        user = User.objects.filter(email=email, is_active=True).first()
        if user:
            _, code = OtpService.create_challenge(user, OtpPurpose.PASSWORD_RESET)
            AuthEmailService.send_password_reset_otp(user.email, code)

        return Response({
            'detail': 'If the account exists, a reset OTP has been sent.',
        })


class PasswordResetConfirmView(APIView):
    """Reset password using OTP."""
    permission_classes = [AllowAny]
    serializer_class = PasswordResetConfirmSerializer

    @extend_schema(
        tags=['Auth'],
        request=PasswordResetConfirmSerializer,
        responses={204: OpenApiResponse(description='Password reset')},
        summary='Confirm password reset with OTP',
    )
    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email']
        code = serializer.validated_data['code']
        new_password = serializer.validated_data['new_password']

        user = User.objects.filter(email=email).first()
        if not user:
            return Response(
                {'detail': 'Invalid email or OTP code.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            OtpService.verify(user, OtpPurpose.PASSWORD_RESET, code)
        except OtpError as exc:
            return otp_error_response(exc)

        user.set_password(new_password)
        user.save(update_fields=['password'])
        return Response({'detail': 'Password reset successfully.'})


class AcceptInviteView(APIView):
    """
    Accept a tenant invitation via the token sent by email.

    - If the invited user already has a password (existing user), they just need to supply
      the token + email and will receive JWT tokens immediately.
    - If the user was created without a password (new invitee), they must also provide a
      password to set on first access.
    """
    permission_classes = [AllowAny]
    serializer_class = AcceptInviteSerializer

    @extend_schema(
        tags=['Auth'],
        request=AcceptInviteSerializer,
        responses={200: OpenApiResponse(description='Invitation accepted, returns tokens')},
        summary='Accept a tenant invitation',
    )
    def post(self, request):
        serializer = AcceptInviteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        token = serializer.validated_data['token']
        email = serializer.validated_data['email']
        password = serializer.validated_data.get('password', '')

        user = User.objects.filter(email=email).first()
        if not user:
            return Response(
                {'detail': 'Invalid invitation token or email.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        membership = UserMembership.objects.filter(
            user=user,
            invitation_token=token,
            accepted_at__isnull=True,
        ).select_related('tenant').first()

        if not membership:
            return Response(
                {'detail': 'Invalid or already-accepted invitation token.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # New users (no usable password) must set one now
        if not user.has_usable_password():
            if not password:
                return Response(
                    {'detail': 'Please provide a password to complete your registration.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            user.set_password(password)
            user.is_active = True
            user.is_email_verified = True
            user.save(update_fields=['password', 'is_active', 'is_email_verified'])

        membership.accepted_at = timezone.now()
        membership.invitation_token = ''
        membership.save(update_fields=['accepted_at', 'invitation_token', 'updated_at'])

        tokens = _issue_tokens(user)
        return Response({
            'detail': 'Invitation accepted.',
            'user': UserSerializer(user).data,
            'tenant': {
                'id': str(membership.tenant.id),
                'name': membership.tenant.name,
                'slug': membership.tenant.slug,
            },
            **tokens,
        })


class RefreshView(TokenRefreshView):
    """Exchange a refresh token for a new access + refresh pair (rotation)."""
    permission_classes = [AllowAny]


class TokenVerifyAPIView(TokenVerifyView):
    """Verify that an access or refresh token is valid."""
    permission_classes = [AllowAny]


class LogoutView(APIView):
    """Blacklist the refresh token so it can't be reused."""
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=['Auth'],
        request={'application/json': {'type': 'object',
                                       'properties': {'refresh': {'type': 'string'}}}},
        responses={205: OpenApiResponse(description='Logged out')},
        summary='Logout (blacklist refresh token)',
    )
    def post(self, request):
        token = request.data.get('refresh')
        if token:
            try:
                RefreshToken(token).blacklist()
            except TokenError:
                pass
        return Response(status=status.HTTP_205_RESET_CONTENT)


class MeView(APIView):
    """Current user profile."""
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=['Auth'],
        responses=UserSerializer,
        summary='Get current user profile',
    )
    def get(self, request):
        return Response(UserSerializer(request.user).data)

    @extend_schema(
        tags=['Auth'],
        request=UserUpdateSerializer,
        responses=UserSerializer,
        summary='Update current user profile',
    )
    def put(self, request):
        serializer = UserUpdateSerializer(request.user, data=request.data, partial=False)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(UserSerializer(request.user).data)

    @extend_schema(
        tags=['Auth'],
        request=UserUpdateSerializer,
        responses=UserSerializer,
        summary='Partially update current user profile',
    )
    def patch(self, request):
        serializer = UserUpdateSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(UserSerializer(request.user).data)


class ChangePasswordView(APIView):
    """Change the current user's password."""
    permission_classes = [IsAuthenticated]
    serializer_class = ChangePasswordSerializer

    @extend_schema(
        tags=['Auth'],
        request=ChangePasswordSerializer,
        responses={204: OpenApiResponse(description='Password changed')},
        summary='Change password',
    )
    def post(self, request):
        serializer = ChangePasswordSerializer(
            data=request.data, context={'request': request}
        )
        serializer.is_valid(raise_exception=True)
        user = request.user
        user.set_password(serializer.validated_data['new_password'])
        user.save(update_fields=['password'])
        return Response(status=status.HTTP_204_NO_CONTENT)


class EraseMyAccountView(APIView):
    """
    GDPR right to erasure — pseudonymize the current user's personal data.

    The account is not hard-deleted (for audit log integrity) but all personally
    identifiable information is replaced with anonymized placeholders and the
    user is permanently deactivated.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=['Auth'],
        request={'application/json': {
            'type': 'object',
            'required': ['password'],
            'properties': {'password': {'type': 'string'}},
        }},
        responses={204: OpenApiResponse(description='Account erased')},
        summary='GDPR — Erase (pseudonymize) current account',
    )
    def post(self, request):
        password = request.data.get('password', '')
        if not request.user.check_password(password):
            return Response(
                {'detail': 'Password is incorrect.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = request.user
        anon_id = user.id.hex[:8]

        user.first_name = 'Deleted'
        user.last_name = 'User'
        user.email = f'erased_{anon_id}@deleted.invalid'
        user.username = f'erased_{anon_id}'
        user.is_active = False
        user.is_erased = True
        user.erased_at = timezone.now()
        user.mfa_secret = ''
        user.mfa_enabled = False
        user.set_unusable_password()
        user.save(update_fields=[
            'first_name', 'last_name', 'email', 'username',
            'is_active', 'is_erased', 'erased_at',
            'mfa_secret', 'mfa_enabled', 'password',
        ])

        # Blacklist the current token if provided
        refresh_token = request.data.get('refresh')
        if refresh_token:
            try:
                from rest_framework_simplejwt.tokens import RefreshToken as RT
                RT(refresh_token).blacklist()
            except Exception:
                pass

        return Response(status=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Users management endpoints
# ---------------------------------------------------------------------------

class UserViewSet(viewsets.ReadOnlyModelViewSet):
    """List and retrieve users in the current tenant."""
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]
    lookup_field = "pk"
    lookup_value_regex = "[0-9a-f-]+"

    def get_queryset(self):
        """Return users that share a tenant with the current user."""
        user = self.request.user
        if user.is_superuser:
            return User.objects.all()
        user_tenant_ids = UserMembership.objects.filter(
            user=user, accepted_at__isnull=False
        ).values_list('tenant_id', flat=True)
        return User.objects.filter(
            memberships__tenant_id__in=user_tenant_ids,
            memberships__accepted_at__isnull=False,
        ).distinct()

    @extend_schema(tags=['Users'], summary='List users in current tenant')
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)

    @extend_schema(tags=['Users'], summary='Get user details')
    def retrieve(self, request, *args, **kwargs):
        return super().retrieve(request, *args, **kwargs)

    @extend_schema(
        tags=['Users'],
        request=InviteUserSerializer,
        responses={201: UserMembershipSerializer},
        summary='Invite a user to the current tenant',
    )
    @action(detail=False, methods=['post'], url_path='invite')
    def invite(self, request):
        serializer = InviteUserSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # The current user must have a tenant membership
        membership = UserMembership.objects.filter(
            user=request.user, accepted_at__isnull=False
        ).first()
        if not membership:
            return Response(
                {'detail': 'No active tenant membership.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        tenant = membership.tenant
        email = serializer.validated_data['email'].lower()

        # Get or create User (without password, pending acceptance)
        user, _ = User.objects.get_or_create(
            email=email,
            defaults={
                'username': email,
                'first_name': serializer.validated_data.get('first_name', ''),
                'last_name': serializer.validated_data.get('last_name', ''),
                'is_active': True,
            },
        )

        # Create invitation
        invitation, created = UserMembership.objects.get_or_create(
            user=user,
            tenant=tenant,
            defaults={
                'invited_by': request.user,
                'invitation_token': UserMembership.generate_invitation_token(),
            },
        )

        if not created:
            return Response(
                {'detail': 'User already has a membership in this tenant.'},
                status=status.HTTP_409_CONFLICT,
            )

        inviter_name = request.user.get_full_name() or request.user.email
        try:
            AuthEmailService.send_invitation(
                email=email,
                tenant_name=tenant.name,
                inviter_name=inviter_name,
                invitation_token=invitation.invitation_token,
            )
        except Exception:
            return Response(
                {
                    'detail': 'Invitation created but email could not be sent. '
                    'Check SMTP settings.',
                    'membership': UserMembershipSerializer(invitation).data,
                },
                status=status.HTTP_201_CREATED,
            )

        return Response(
            UserMembershipSerializer(invitation).data,
            status=status.HTTP_201_CREATED,
        )

    @extend_schema(
        tags=['Users'],
        responses={204: OpenApiResponse(description='User deactivated')},
        summary='Deactivate a user',
    )
    @action(detail=True, methods=['post'], url_path='deactivate')
    def deactivate(self, request, pk=None):
        user = self.get_object()
        if user == request.user:
            return Response(
                {'detail': 'Cannot deactivate yourself.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user.is_active = False
        user.save(update_fields=['is_active'])
        return Response(status=status.HTTP_204_NO_CONTENT)