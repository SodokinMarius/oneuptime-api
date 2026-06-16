"""Webhook emissions for monitor lifecycle events."""


def emit_monitor_status_changed(monitor, previous_status: str) -> None:
    """Fire webhook when a monitor's operational status changes."""
    if previous_status == monitor.status:
        return
    try:
        from apps.monitoring.serializers import MonitorSerializer
        from apps.webhooks.services import WebhookService

        WebhookService.emit(
            tenant=monitor.tenant,
            project=monitor.project,
            event_type="monitor.status_changed",
            payload={
                "monitor": MonitorSerializer(monitor).data,
                "previous_status": previous_status,
                "status": monitor.status,
            },
        )
    except Exception:
        pass
