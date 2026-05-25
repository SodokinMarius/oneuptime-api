"""
Onboarding service — atomic creation of User + Tenant + Project + Membership.

Maps to OneUptime document §9 (White-Glove Onboarding).
"""
from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils.text import slugify

from apps.accounts.models import UserMembership, User
from apps.tenancy.models import Project, Tenant

User = get_user_model()


class OnboardingService:
    """
    Handles the initial setup when a new user registers:
    1. Create the User
    2. Create the Tenant
    3. Create a default Project
    4. Link User to Tenant as owner via UserMembership
    """

    @staticmethod
    @transaction.atomic
    def create_account(
        email: str,
        password: str,
        tenant_name: str,
        first_name: str = '',
        last_name: str = '',
    ) -> tuple[User, Tenant, Project]:
        """
        Create a complete account atomically.
        Raises django.db.IntegrityError if email or tenant slug is taken.
        """
        # 1. User
        user = User.objects.create_user(
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name,
        )

        # 2. Tenant (with unique slug derived from name)
        slug = OnboardingService._unique_tenant_slug(tenant_name)
        tenant = Tenant.objects.create(
            name=tenant_name,
            slug=slug,
        )

        # 3. Default project
        project = Project.objects.create(
            tenant=tenant,
            name='Default',
            slug='default',
            description='Default project created automatically at signup.',
        )

        # 4. Membership (owner)
        UserMembership.objects.create(
            user=user,
            tenant=tenant,
            is_owner=True,
            accepted_at=user.created_at,  
        )

        return user, tenant, project

    @staticmethod
    def _unique_tenant_slug(name: str) -> str:
        """Generate a unique tenant slug from a name."""
        base = slugify(name) or 'tenant'
        slug = base
        suffix = 1
        while Tenant.objects.filter(slug=slug).exists():
            suffix += 1
            slug = f'{base}-{suffix}'
        return slug