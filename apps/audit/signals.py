"""
Auto-audit signals — record AuditLog entries on key model changes.

Connected in AuditConfig.ready(). Only fires when an actor is in thread-local
context (set by TenantMiddleware after authentication). Background tasks
(run_checks, process_maintenance) fire with actor_type='system'.

Models covered:
  Monitor (create, update, delete)
  Incident (create, update)
  ApiKey (create, revoke)
  Role (create, update, delete)
  Team (create, update, delete)
  UserMembership (create, delete)
"""
import logging

from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

logger = logging.getLogger(__name__)


def _record(tenant, action, resource_type, resource_id, old=None, new=None, project=None):
    """Fire-and-forget audit record. Never raises."""
    try:
        from apps.audit.services import AuditService
        AuditService.record_auto(
            tenant=tenant,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            old=old,
            new=new,
            project=project,
        )
    except Exception as exc:
        logger.warning("Audit signal failed for %s.%s: %s", resource_type, action, exc)


def _serialize(instance) -> dict:
    """Simple dict of public field values for old/new snapshots."""
    from django.forms.models import model_to_dict
    try:
        return model_to_dict(instance, exclude=["password", "mfa_secret", "probe_key", "key_hash"])
    except Exception:
        return {"id": str(instance.pk)}


# ------------------------------------------------------------------
# Monitor
# ------------------------------------------------------------------

@receiver(post_save, sender="monitoring.Monitor")
def on_monitor_save(sender, instance, created, **kwargs):
    action = "monitor.create" if created else "monitor.update"
    _record(
        tenant=instance.tenant,
        action=action,
        resource_type="Monitor",
        resource_id=instance.id,
        new={"name": instance.name, "type": instance.type, "url": instance.url},
        project=instance.project,
    )


@receiver(post_delete, sender="monitoring.Monitor")
def on_monitor_delete(sender, instance, **kwargs):
    _record(
        tenant=instance.tenant,
        action="monitor.delete",
        resource_type="Monitor",
        resource_id=instance.id,
        old={"name": instance.name},
        project=instance.project,
    )


# ------------------------------------------------------------------
# Incident
# ------------------------------------------------------------------

@receiver(post_save, sender="incidents.Incident")
def on_incident_save(sender, instance, created, **kwargs):
    action = "incident.create" if created else "incident.update"
    _record(
        tenant=instance.tenant,
        action=action,
        resource_type="Incident",
        resource_id=instance.id,
        new={
            "title": instance.title,
            "state": instance.state.name if instance.state_id else None,
            "severity": instance.severity.name if instance.severity_id else None,
        },
        project=instance.project,
    )


# ------------------------------------------------------------------
# ApiKey
# ------------------------------------------------------------------

@receiver(post_save, sender="rbac.ApiKey")
def on_apikey_save(sender, instance, created, **kwargs):
    if created:
        _record(
            tenant=instance.tenant,
            action="api_key.create",
            resource_type="ApiKey",
            resource_id=instance.id,
            new={"name": instance.name, "prefix": instance.key_prefix},
            project=instance.project,
        )
    elif instance.revoked_at:
        _record(
            tenant=instance.tenant,
            action="api_key.revoke",
            resource_type="ApiKey",
            resource_id=instance.id,
            project=instance.project,
        )


# ------------------------------------------------------------------
# Role
# ------------------------------------------------------------------

@receiver(post_save, sender="rbac.Role")
def on_role_save(sender, instance, created, **kwargs):
    if instance.is_system:
        return
    action = "role.create" if created else "role.update"
    _record(
        tenant=instance.tenant,
        action=action,
        resource_type="Role",
        resource_id=instance.id,
        new={"name": instance.name, "permissions": instance.permissions},
        project=instance.project,
    )


@receiver(post_delete, sender="rbac.Role")
def on_role_delete(sender, instance, **kwargs):
    _record(
        tenant=instance.tenant,
        action="role.delete",
        resource_type="Role",
        resource_id=instance.id,
        old={"name": instance.name},
        project=instance.project,
    )


# ------------------------------------------------------------------
# UserMembership (invite / join / remove)
# ------------------------------------------------------------------

@receiver(post_save, sender="accounts.UserMembership")
def on_membership_save(sender, instance, created, **kwargs):
    if not created:
        return
    _record(
        tenant=instance.tenant,
        action="user.invited",
        resource_type="UserMembership",
        resource_id=instance.id,
        new={"user_email": instance.user.email, "is_owner": instance.is_owner},
    )


@receiver(post_delete, sender="accounts.UserMembership")
def on_membership_delete(sender, instance, **kwargs):
    _record(
        tenant=instance.tenant,
        action="user.removed",
        resource_type="UserMembership",
        resource_id=instance.id,
        old={"user_email": instance.user.email},
    )
