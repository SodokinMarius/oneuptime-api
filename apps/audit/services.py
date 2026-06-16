"""
AuditService — append-only, hash-chained audit log.

Usage:
    from apps.audit.services import AuditService

    AuditService.record(
        tenant=tenant,
        action="monitor.create",
        actor=request.user,           # User or ApiKey instance
        resource_type="Monitor",
        resource_id=monitor.id,
        new={"name": "prod"},
        request=request,              # optional, for IP / user-agent
    )

Thread-local actor injection (set in TenantMiddleware):
    AuditService.set_current_actor(user, request)
    # later, in signals:
    AuditService.record_auto(tenant, action, resource_type, resource_id, old, new)
"""
import hashlib
import json
import threading
from contextlib import contextmanager

from django.db import transaction
from django.utils import timezone

_local = threading.local()


class AuditService:
    # ------------------------------------------------------------------
    # Thread-local actor (injected by middleware for signal-based logging)
    # ------------------------------------------------------------------

    @staticmethod
    def set_current_actor(user, request=None):
        """Call from middleware after authentication. Stored per-thread."""
        _local.actor = user
        _local.request = request

    @staticmethod
    def clear_current_actor():
        _local.actor = None
        _local.request = None

    @staticmethod
    def get_current_actor():
        return getattr(_local, "actor", None)

    @staticmethod
    def get_current_request():
        return getattr(_local, "request", None)

    # ------------------------------------------------------------------
    # Core record method
    # ------------------------------------------------------------------

    @classmethod
    def record(
        cls,
        tenant,
        action: str,
        actor=None,
        resource_type: str = "",
        resource_id=None,
        old=None,
        new=None,
        request=None,
        project=None,
    ):
        """
        Append an immutable audit record.
        Uses SELECT FOR UPDATE on the last record to ensure sequential hashing.
        """
        from apps.audit.models import ActorType, AuditLog

        if actor is None:
            actor = cls.get_current_actor()
        if request is None:
            request = cls.get_current_request()

        actor_id, actor_type = cls._resolve_actor(actor)

        with transaction.atomic():
            prev = (
                AuditLog.objects.filter(tenant=tenant)
                .order_by("-id")
                .select_for_update()
                .first()
            )
            prev_hash = prev.record_hash if prev else "0" * 64

            payload = {
                "tenant": str(tenant.id),
                "actor_id": str(actor_id),
                "actor_type": actor_type,
                "action": action,
                "resource_type": resource_type,
                "resource_id": str(resource_id) if resource_id else None,
                "old": old,
                "new": new,
                "prev_hash": prev_hash,
            }
            record_hash = hashlib.sha256(
                json.dumps(payload, sort_keys=True, default=str).encode()
            ).hexdigest()

            log = AuditLog(
                tenant=tenant,
                project=project,
                actor_id=actor_id,
                actor_type=actor_type,
                action=action,
                resource_type=resource_type,
                resource_id=resource_id,
                old_value=old,
                new_value=new,
                ip_address=cls._get_ip(request),
                user_agent=cls._get_ua(request),
                prev_hash=prev_hash,
                record_hash=record_hash,
            )
            # Bypass the immutability guard (this is the initial save)
            super(AuditLog, log).save()
            return log

    @classmethod
    def record_auto(
        cls,
        tenant,
        action,
        resource_type="",
        resource_id=None,
        old=None,
        new=None,
        project=None,
    ):
        """Shortcut for signal-based recording — uses thread-local actor."""
        actor = cls.get_current_actor()
        if actor is None:
            actor_id = None
            from apps.audit.models import ActorType
            actor_type = ActorType.SYSTEM
        else:
            actor_id, actor_type = cls._resolve_actor(actor)

        from apps.audit.models import AuditLog
        with transaction.atomic():
            prev = (
                AuditLog.objects.filter(tenant=tenant)
                .order_by("-id")
                .select_for_update()
                .first()
            )
            prev_hash = prev.record_hash if prev else "0" * 64

            payload = {
                "tenant": str(tenant.id),
                "actor_id": str(actor_id) if actor_id else None,
                "actor_type": actor_type,
                "action": action,
                "resource_type": resource_type,
                "resource_id": str(resource_id) if resource_id else None,
                "old": old,
                "new": new,
                "prev_hash": prev_hash,
            }
            record_hash = hashlib.sha256(
                json.dumps(payload, sort_keys=True, default=str).encode()
            ).hexdigest()

            log = AuditLog(
                tenant=tenant,
                project=project,
                actor_id=actor_id or tenant.id,
                actor_type=actor_type,
                action=action,
                resource_type=resource_type,
                resource_id=resource_id,
                old_value=old,
                new_value=new,
                ip_address=cls._get_ip(cls.get_current_request()),
                user_agent=cls._get_ua(cls.get_current_request()),
                prev_hash=prev_hash,
                record_hash=record_hash,
            )
            super(AuditLog, log).save()
            return log

    # ------------------------------------------------------------------
    # Chain verification
    # ------------------------------------------------------------------

    @classmethod
    def verify_chain(cls, tenant, since=None) -> dict:
        """
        Verify the integrity of the audit chain for a tenant.
        Returns {"valid": bool, "checked": int, "broken": list[{id, reason}]}.
        """
        from apps.audit.models import AuditLog

        qs = AuditLog.objects.filter(tenant=tenant).order_by("id")
        if since:
            qs = qs.filter(created_at__gte=since)

        prev_hash = "0" * 64
        broken = []
        checked = 0

        for log in qs.iterator(chunk_size=500):
            if log.prev_hash != prev_hash:
                broken.append({"id": log.id, "reason": "prev_hash_mismatch"})

            expected = cls._recompute_hash(log, prev_hash)
            if expected != log.record_hash:
                broken.append({"id": log.id, "reason": "record_hash_mismatch"})

            prev_hash = log.record_hash
            checked += 1

        return {"valid": len(broken) == 0, "checked": checked, "broken": broken}

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _resolve_actor(actor):
        from apps.audit.models import ActorType

        if actor is None:
            from django.conf import settings
            return None, ActorType.SYSTEM

        # ApiKey instance
        try:
            from apps.rbac.models import ApiKey
            if isinstance(actor, ApiKey):
                return actor.id, ActorType.API_KEY
        except ImportError:
            pass

        # User instance
        return actor.id, ActorType.USER

    @staticmethod
    def _recompute_hash(log, prev_hash: str) -> str:
        payload = {
            "tenant": str(log.tenant_id),
            "actor_id": str(log.actor_id),
            "actor_type": log.actor_type,
            "action": log.action,
            "resource_type": log.resource_type,
            "resource_id": str(log.resource_id) if log.resource_id else None,
            "old": log.old_value,
            "new": log.new_value,
            "prev_hash": prev_hash,
        }
        return hashlib.sha256(
            json.dumps(payload, sort_keys=True, default=str).encode()
        ).hexdigest()

    @staticmethod
    def _get_ip(request) -> str | None:
        if not request:
            return None
        xff = request.META.get("HTTP_X_FORWARDED_FOR")
        if xff:
            return xff.split(",")[0].strip()
        return request.META.get("REMOTE_ADDR")

    @staticmethod
    def _get_ua(request) -> str:
        if not request:
            return ""
        return request.META.get("HTTP_USER_AGENT", "")
