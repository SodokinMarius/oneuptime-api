"""URL routes for accounts app."""
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.accounts.views import (
    AcceptInviteView,
    ActivateAccountView,
    ChangePasswordView,
    EraseMyAccountView,
    LoginView,
    LogoutView,
    MeView,
    MfaConfirmView,
    MfaDisableView,
    MfaSetupView,
    MfaVerifyLoginView,
    PasswordResetConfirmView,
    PasswordResetRequestView,
    RefreshView,
    RegisterView,
    ResendActivationView,
    TokenVerifyAPIView,
    UserViewSet,
)

router = DefaultRouter()
router.register(r'users', UserViewSet, basename='user')

urlpatterns = [
    # Auth — registration & activation
    path('auth/register/', RegisterView.as_view(), name='register'),
    path('auth/activate/', ActivateAccountView.as_view(), name='activate'),
    path('auth/resend-activation/', ResendActivationView.as_view(), name='resend-activation'),
    path('auth/accept-invite/', AcceptInviteView.as_view(), name='accept-invite'),

    # Auth — JWT
    path('auth/login/', LoginView.as_view(), name='login'),
    path('auth/refresh/', RefreshView.as_view(), name='refresh'),
    path('auth/token/verify/', TokenVerifyAPIView.as_view(), name='token-verify'),
    path('auth/logout/', LogoutView.as_view(), name='logout'),

    # Auth — MFA (TOTP)
    path('auth/mfa/verify-login/', MfaVerifyLoginView.as_view(), name='mfa-verify-login'),
    path('auth/mfa/setup/', MfaSetupView.as_view(), name='mfa-setup'),
    path('auth/mfa/confirm/', MfaConfirmView.as_view(), name='mfa-confirm'),
    path('auth/mfa/disable/', MfaDisableView.as_view(), name='mfa-disable'),

    # Auth — password
    path('auth/change-password/', ChangePasswordView.as_view(), name='change-password'),
    path('auth/password-reset/', PasswordResetRequestView.as_view(), name='password-reset'),
    path(
        'auth/password-reset/confirm/',
        PasswordResetConfirmView.as_view(),
        name='password-reset-confirm',
    ),

    # Profile
    path('auth/me/', MeView.as_view(), name='me'),
    path('auth/erase-account/', EraseMyAccountView.as_view(), name='erase-account'),

    # Users
    path('', include(router.urls)),
]
