"""URL routes for incidents app."""
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.incidents.views import (
    IncidentSeverityViewSet,
    IncidentStateViewSet,
    IncidentViewSet,
)
from apps.incidents.views_escalation import (
    EscalationPolicyViewSet,
    IncidentWorkflowRuleViewSet,
)

router = DefaultRouter()
router.register(r"incidents", IncidentViewSet, basename="incident")
router.register(r"incident-states", IncidentStateViewSet, basename="incident-state")
router.register(r"incident-severities", IncidentSeverityViewSet, basename="incident-severity")
router.register(r"escalation-policies", EscalationPolicyViewSet, basename="escalation-policy")
router.register(r"incident-workflows", IncidentWorkflowRuleViewSet, basename="incident-workflow")

urlpatterns = [
    path("", include(router.urls)),
]
