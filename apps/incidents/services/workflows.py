"""Incident workflow rule execution."""
from __future__ import annotations

import logging
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.utils import timezone

from apps.incidents.models import Incident, IncidentWorkflowRule

logger = logging.getLogger(__name__)
User = get_user_model()


def run_workflow_rules(trigger: str, incident: Incident) -> int:
    """Execute all active workflow rules matching trigger and conditions."""
    rules = IncidentWorkflowRule.objects.filter(
        project=incident.project,
        trigger=trigger,
        is_active=True,
    )
    executed = 0
    for rule in rules:
        if not _conditions_match(rule, incident):
            continue
        _execute_actions(rule, incident)
        executed += 1
    return executed


def process_unacknowledged_workflows() -> int:
    """Evaluate incident_unacknowledged rules for open incidents past delay."""
    now = timezone.now()
    count = 0
    rules = IncidentWorkflowRule.objects.filter(
        trigger=IncidentWorkflowRule.Trigger.INCIDENT_UNACKNOWLEDGED,
        is_active=True,
    )
    if not rules.exists():
        return 0

    incidents = Incident.objects.filter(
        acknowledged_at__isnull=True,
        state__is_resolved_state=False,
    ).select_related("severity", "project", "tenant")

    for incident in incidents:
        for rule in rules.filter(project=incident.project):
            delay = int((rule.conditions or {}).get("delay_minutes", 15))
            if now < incident.triggered_at + timedelta(minutes=delay):
                continue
            if not _conditions_match(rule, incident):
                continue
            cache_key = f"workflow:{rule.id}:{incident.id}"
            if _workflow_already_fired(cache_key):
                continue
            _execute_actions(rule, incident)
            _mark_workflow_fired(cache_key)
            count += 1
    return count


def _conditions_match(rule: IncidentWorkflowRule, incident: Incident) -> bool:
    conditions = rule.conditions or {}
    severity_names = conditions.get("severity_names") or conditions.get("severity")
    if severity_names:
        if incident.severity.name not in severity_names:
            return False
    monitor_id = conditions.get("monitor_id")
    if monitor_id and str(incident.monitor_id) != str(monitor_id):
        return False
    return True


def _execute_actions(rule: IncidentWorkflowRule, incident: Incident) -> None:
    from apps.incidents.services import lifecycle

    for action in rule.actions or []:
        action_type = action.get("type")
        try:
            if action_type == "webhook":
                webhook_id = action.get("webhook_id")
                if webhook_id:
                    _fire_webhook(incident, webhook_id, rule.name)
            elif action_type == "assign":
                user_id = action.get("user_id")
                if user_id:
                    user = User.objects.filter(id=user_id).first()
                    if user:
                        lifecycle.assign_incident(incident, user)
            elif action_type == "notify_user":
                user_id = action.get("user_id")
                if user_id:
                    user = User.objects.filter(id=user_id).first()
                    if user:
                        from apps.incidents.services.escalation import _notify_user

                        _notify_user(incident, user)
            elif action_type == "increase_severity":
                severity_id = action.get("severity_id")
                if severity_id:
                    from apps.incidents.models import IncidentSeverity

                    severity = IncidentSeverity.objects.filter(
                        id=severity_id, project=incident.project
                    ).first()
                    if severity:
                        incident.severity = severity
                        incident.save(update_fields=["severity", "updated_at"])
                        lifecycle._emit("incident.escalated", incident)
        except Exception as exc:
            logger.warning("Workflow action %s failed for rule %s: %s", action_type, rule.id, exc)


def _fire_webhook(incident, webhook_id, rule_name: str) -> None:
    from apps.incidents.serializers import IncidentSerializer
    from apps.webhooks.models import Webhook
    from apps.webhooks.services import WebhookService

    if not Webhook.objects.filter(id=webhook_id, project=incident.project, is_active=True).exists():
        return
    WebhookService.emit(
        tenant=incident.tenant,
        project=incident.project,
        event_type="incident.workflow",
        payload={
            "incident": IncidentSerializer(incident).data,
            "workflow_rule": rule_name,
            "webhook_id": str(webhook_id),
        },
    )


def _workflow_already_fired(cache_key: str) -> bool:
    try:
        from django.core.cache import cache

        return bool(cache.get(cache_key))
    except Exception:
        return False


def _mark_workflow_fired(cache_key: str) -> None:
    try:
        from django.core.cache import cache

        cache.set(cache_key, True, timeout=60 * 60 * 24)
    except Exception:
        pass
