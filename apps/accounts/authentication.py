"""Custom JWT authentication with account state checks."""
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import AuthenticationFailed


class ActiveVerifiedJWTAuthentication(JWTAuthentication):
    """Reject tokens for inactive or unverified users."""

    def get_user(self, validated_token):
        user = super().get_user(validated_token)
        if not user.is_active:
            raise AuthenticationFailed('Account is disabled.', code='account_disabled')
        if not user.is_email_verified:
            raise AuthenticationFailed(
                'Email address is not verified.',
                code='email_not_verified',
            )
        if user.is_erased:
            raise AuthenticationFailed('Account has been erased.', code='account_erased')
        return user
