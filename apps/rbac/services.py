"""
RBAC bootstrap services — called during onboarding to populate
system roles, incident states/severities, and default probes.
"""
import secrets

from apps.rbac.constants import (
    DEFAULT_INCIDENT_SEVERITIES,
    DEFAULT_INCIDENT_STATES,
    DEFAULT_PROBE_LOCATIONS,
    SYSTEM_ROLES,
)


def create_system_roles(project, tenant):
    """Create admin / member / viewer roles for a newly created project."""
    from apps.rbac.models import Role

    roles = {}
    for name, cfg in SYSTEM_ROLES.items():
        role, _ = Role.objects.get_or_create(
            project=project,
            name=name,
            defaults={
                "tenant": tenant,
                "description": cfg["description"],
                "permissions": cfg["permissions"],
                "is_system": True,
            },
        )
        roles[name] = role
    return roles


def create_system_incident_states(project, tenant):
    """Create default incident states for a newly created project."""
    from apps.incidents.models import IncidentState

    states = {}
    for data in DEFAULT_INCIDENT_STATES:
        state, _ = IncidentState.objects.get_or_create(
            project=project,
            name=data["name"],
            defaults={
                "tenant": tenant,
                "color": data["color"],
                "order": data["order"],
                "is_resolved_state": data["is_resolved_state"],
                "is_system": True,
            },
        )
        states[data["name"]] = state
    return states


def create_system_incident_severities(project, tenant):
    """Create default incident severities for a newly created project."""
    from apps.incidents.models import IncidentSeverity

    severities = {}
    for data in DEFAULT_INCIDENT_SEVERITIES:
        severity, _ = IncidentSeverity.objects.get_or_create(
            project=project,
            name=data["name"],
            defaults={
                "tenant": tenant,
                "color": data["color"],
                "order": data["order"],
                "is_system": True,
            },
        )
        severities[data["name"]] = severity
    return severities


def create_default_probes(project, tenant):
    """Create default simulated probe locations for a project."""
    from apps.monitoring.models import Probe

    probes = []
    for data in DEFAULT_PROBE_LOCATIONS:
        probe, _ = Probe.objects.get_or_create(
            project=project,
            location=data["location"],
            defaults={
                "tenant": tenant,
                "name": data["name"],
                "probe_key": secrets.token_hex(32),
                "is_active": True,
            },
        )
        probes.append(probe)
    return probes


def bootstrap_project(project, tenant):
    """
    Full project initialization — call once after Project creation.
    Returns a dict with all created/retrieved system objects.
    """
    roles = create_system_roles(project, tenant)
    states = create_system_incident_states(project, tenant)
    severities = create_system_incident_severities(project, tenant)
    probes = create_default_probes(project, tenant)
    return {
        "roles": roles,
        "incident_states": states,
        "incident_severities": severities,
        "probes": probes,
    }
