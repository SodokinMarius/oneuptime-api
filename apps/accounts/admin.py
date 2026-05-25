"""Admin registrations for accounts app."""
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from apps.accounts.models import User, UserMembership


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ('email', 'first_name', 'last_name', 'is_active',
                    'is_email_verified', 'is_staff', 'is_superuser',
                    'mfa_enabled', 'created_at')
    list_filter = ('is_active', 'is_staff', 'is_superuser', 'mfa_enabled',
                   'is_erased', 'created_at')
    search_fields = ('email', 'first_name', 'last_name', 'username')
    ordering = ('-created_at',)
    readonly_fields = ('id', 'created_at', 'updated_at', 'last_login',
                       'date_joined', 'is_erased', 'erased_at', 'last_login_ip')

    fieldsets = (
        (None, {'fields': ('id', 'email', 'username', 'password')}),
        ('Personal info', {'fields': ('first_name', 'last_name')}),
        ('Permissions', {
            'fields': ('is_active', 'is_staff', 'is_superuser',
                       'groups', 'user_permissions'),
        }),
        ('Compliance', {
            'fields': ('mfa_enabled', 'session_timeout_minutes',
                       'last_login_ip', 'is_erased', 'erased_at'),
        }),
        ('Important dates', {
            'fields': ('last_login', 'date_joined', 'created_at', 'updated_at'),
        }),
    )

    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'username', 'password1', 'password2'),
        }),
    )


@admin.register(UserMembership)
class UserMembershipAdmin(admin.ModelAdmin):
    list_display = ('user', 'tenant', 'is_owner', 'invited_at',
                    'accepted_at', 'is_accepted')
    list_filter = ('is_owner', 'accepted_at', 'invited_at')
    search_fields = ('user__email', 'tenant__name', 'tenant__slug')
    readonly_fields = ('id', 'invitation_token', 'invited_at',
                       'created_at', 'updated_at')
    autocomplete_fields = ('user', 'tenant', 'invited_by')