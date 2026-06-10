"""
enforce_sso policy — block password login and require SSO JWT claim per project.
"""
from __future__ import annotations

from django.contrib.auth import get_user_model

from apps.rbac.models import TeamMembership
from apps.sso.models import SSOConfig

User = get_user_model()


class SSOEnforcement:
    @staticmethod
    def user_requires_sso_login(user: User) -> bool:
        """
        Return True if the user belongs to any project with enforce_sso enabled.
        Password login should be blocked in that case.
        """
        if user.is_superuser:
            return False
        project_ids = TeamMembership.objects.filter(
            user=user
        ).values_list("team__project_id", flat=True).distinct()
        return SSOConfig.objects.filter(
            project_id__in=project_ids,
            is_enabled=True,
            enforce_sso=True,
        ).exists()

    @staticmethod
    def project_requires_sso(project_id) -> bool:
        return SSOConfig.objects.filter(
            project_id=project_id,
            is_enabled=True,
            enforce_sso=True,
        ).exists()

    @staticmethod
    def has_sso_access(request, project_id) -> bool:
        """
        Check if the current request has a valid SSO auth marker for the project.
        API keys bypass SSO enforcement (machine-to-machine).
        """
        if getattr(request, "api_key", None):
            return True
        if request.user.is_superuser:
            return True
        sso_projects = getattr(request, "sso_projects", []) or []
        return str(project_id) in [str(p) for p in sso_projects]
