"""Incident escalation processing."""
from __future__ import annotations

import logging
from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from apps.incidents.models import (
    EscalationPolicy,
    EscalationStep,
    Incident,
    IncidentEscalationState,
)

logger = logging.getLogger(__name__)


def resolve_policy_for_incident(incident: Incident) -> EscalationPolicy | None:
    """Pick the best matching active escalation policy for an incident."""
    qs = EscalationPolicy.objects.filter(
        project=incident.project,
        is_active=True,
    ).prefetch_related("steps")

    if incident.team_id:
        team_policy = qs.filter(team_id=incident.team_id).order_by("-is_default").first()
        if team_policy and team_policy.steps.exists():
            return team_policy

    for policy in qs.filter(team__isnull=True).order_by("-is_default", "name"):
        names = policy.severity_names or []
        if names and incident.severity.name not in names:
            continue
        if policy.steps.exists():
            return policy
    return None


def attach_escalation_policy(incident: Incident) -> IncidentEscalationState | None:
    """Create escalation tracking when an incident is opened."""
    policy = resolve_policy_for_incident(incident)
    if policy is None:
        return None

    state, _ = IncidentEscalationState.objects.get_or_create(
        incident=incident,
        defaults={"policy": policy, "current_step_order": 0},
    )
    return state


def process_escalations() -> dict:
    """Run pending escalation steps for open, unacknowledged incidents."""
    now = timezone.now()
    stats = {"processed": 0, "escalated": 0, "completed": 0}

    open_incidents = Incident.objects.filter(
        acknowledged_at__isnull=True,
        state__is_resolved_state=False,
        escalation_state__completed=False,
    ).select_related(
        "escalation_state",
        "escalation_state__policy",
        "severity",
        "project",
        "tenant",
    )

    for incident in open_incidents:
        stats["processed"] += 1
        state = incident.escalation_state
        next_step = (
            EscalationStep.objects.filter(
                policy=state.policy,
                order=state.current_step_order + 1,
            )
            .select_related("webhook", "user", "target_severity")
            .first()
        )
        if next_step is None:
            if not state.completed:
                state.completed = True
                state.save(update_fields=["completed", "updated_at"])
                stats["completed"] += 1
            continue

        reference_time = incident.triggered_at if state.current_step_order == 0 else state.last_escalated_at
        if reference_time is None:
            reference_time = incident.triggered_at
        due_at = reference_time + timedelta(minutes=next_step.delay_minutes)
        if now < due_at:
            continue

        _execute_escalation_step(incident, state, next_step)
        stats["escalated"] += 1

    return stats


def _execute_escalation_step(incident, state, step: EscalationStep) -> None:
    from apps.incidents.services import lifecycle

    with transaction.atomic():
        if step.action == EscalationStep.Action.NOTIFY_WEBHOOK and step.webhook_id:
            _emit_escalation_webhook(incident, step)
        elif step.action == EscalationStep.Action.NOTIFY_USER and step.user_id:
            _notify_user(incident, step.user)
        elif step.action == EscalationStep.Action.INCREASE_SEVERITY and step.target_severity_id:
            incident.severity = step.target_severity
            incident.save(update_fields=["severity", "updated_at"])
        elif step.action == EscalationStep.Action.ASSIGN_USER and step.user_id:
            lifecycle.assign_incident(incident, step.user)

        state.current_step_order = step.order
        state.last_escalated_at = timezone.now()
        remaining = EscalationStep.objects.filter(
            policy=state.policy, order__gt=step.order
        ).exists()
        state.completed = not remaining
        state.save(update_fields=["current_step_order", "last_escalated_at", "completed", "updated_at"])

    lifecycle._emit("incident.escalated", incident)


def _emit_escalation_webhook(incident, step: EscalationStep) -> None:
    from apps.incidents.serializers import IncidentSerializer
    from apps.webhooks.services import WebhookService

    WebhookService.emit(
        tenant=incident.tenant,
        project=incident.project,
        event_type="incident.escalated",
        payload={
            "incident": IncidentSerializer(incident).data,
            "escalation_step": {
                "order": step.order,
                "action": step.action,
                "webhook_id": str(step.webhook_id) if step.webhook_id else None,
            },
        },
    )


def _notify_user(incident, user) -> None:
    """Send escalation email when SMTP is configured."""
    from django.conf import settings
    from django.core.mail import send_mail

    if not settings.EMAIL_HOST:
        logger.info("Escalation notify_user skipped — EMAIL_HOST not configured")
        return

    subject = f"[OneUptime] Escalation: {incident.title}"
    body = (
        f"Incident '{incident.title}' requires attention.\n"
        f"Severity: {incident.severity.name}\n"
        f"Triggered at: {incident.triggered_at}\n"
    )
    try:
        send_mail(subject, body, settings.DEFAULT_FROM_EMAIL, [user.email], fail_silently=False)
    except Exception as exc:
        logger.warning("Escalation email to %s failed: %s", user.email, exc)
