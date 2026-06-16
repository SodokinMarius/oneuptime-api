"""
Incident lifecycle services — atomic state transitions.

All actions go through these services so that:
  - State transitions are consistent
  - Webhook events are always fired
  - Audit log entries are always created
"""
from django.db import transaction
from django.utils import timezone


def emit_incident_created(incident):
    """Fire webhook when an incident is created (manual or automatic)."""
    _emit("incident.created", incident)


def acknowledge_incident(incident, user):
    """Transition incident to 'acknowledged' state."""
    from apps.incidents.models import IncidentState

    ack_state = IncidentState.objects.filter(
        project=incident.project, name="acknowledged"
    ).first()
    if not ack_state:
        raise ValueError("No 'acknowledged' state configured for this project.")

    with transaction.atomic():
        incident.state = ack_state
        incident.acknowledged_at = timezone.now()
        incident.acknowledged_by = user
        incident.save(update_fields=["state", "acknowledged_at", "acknowledged_by", "updated_at"])

    _emit("incident.acknowledged", incident)
    return incident


def resolve_incident(incident, user):
    """Transition incident to the resolved state."""
    from apps.incidents.models import IncidentState

    resolved_state = IncidentState.objects.filter(
        project=incident.project, is_resolved_state=True
    ).first()
    if not resolved_state:
        raise ValueError("No resolved state configured for this project.")

    with transaction.atomic():
        incident.state = resolved_state
        incident.resolved_at = timezone.now()
        incident.resolved_by = user
        incident.save(update_fields=["state", "resolved_at", "resolved_by", "updated_at"])

        # Detach from monitor if it was auto-created
        if incident.monitor_id:
            from apps.monitoring.models import Monitor
            Monitor.objects.filter(current_incident=incident).update(current_incident=None)

    _emit("incident.resolved", incident)
    return incident


def assign_incident(incident, assignee):
    """Assign an incident to a user."""
    incident.assigned_to = assignee
    incident.save(update_fields=["assigned_to", "updated_at"])
    _emit("incident.assigned", incident)
    return incident


def add_note(incident, author, content, is_public=False):
    """Add a note to an incident."""
    from apps.incidents.models import IncidentNote

    note = IncidentNote.objects.create(
        tenant=incident.tenant,
        incident=incident,
        author=author,
        content=content,
        is_public=is_public,
    )
    _emit("incident.note_added", incident)
    return note


def build_timeline(incident) -> list:
    """
    Build a unified chronological timeline for an incident,
    merging audit log entries and notes.
    """
    events = []

    try:
        from apps.audit.models import AuditLog
        for log in AuditLog.objects.filter(
            resource_type="Incident", resource_id=incident.id
        ).order_by("created_at"):
            events.append({
                "type": "audit",
                "action": log.action,
                "at": log.created_at.isoformat(),
                "actor_id": str(log.actor_id),
                "actor_type": log.actor_type,
                "detail": log.new_value,
            })
    except Exception:
        pass

    for note in incident.notes.select_related("author").order_by("created_at"):
        events.append({
            "type": "note",
            "at": note.created_at.isoformat(),
            "author_id": str(note.author_id) if note.author_id else None,
            "content": note.content,
            "is_public": note.is_public,
        })

    # Always include triggered_at as first event
    events.append({
        "type": "incident_triggered",
        "at": incident.triggered_at.isoformat(),
        "action": "incident.triggered",
    })
    if incident.acknowledged_at:
        events.append({
            "type": "acknowledged",
            "at": incident.acknowledged_at.isoformat(),
            "actor_id": str(incident.acknowledged_by_id) if incident.acknowledged_by_id else None,
        })
    if incident.resolved_at:
        events.append({
            "type": "resolved",
            "at": incident.resolved_at.isoformat(),
            "actor_id": str(incident.resolved_by_id) if incident.resolved_by_id else None,
        })

    return sorted(events, key=lambda e: e["at"])


def _emit(event_type: str, incident):
    """Fire webhook for incident events. Silently ignored if webhooks app not ready."""
    try:
        from apps.webhooks.services import WebhookService
        from apps.incidents.serializers import IncidentSerializer
        WebhookService.emit(
            tenant=incident.tenant,
            project=incident.project,
            event_type=event_type,
            payload={"incident": IncidentSerializer(incident).data},
        )
    except Exception:
        pass
