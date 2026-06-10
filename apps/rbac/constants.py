"""
Exhaustive list of permissions and system role definitions.

Permission format: resource:action
Wildcards supported in role.permissions:
  "*"          → all permissions
  "monitor:*"  → all actions on monitors
  "*:read"     → read on all resources
"""

ALL_PERMISSIONS = [
    # --- Monitoring ---
    "monitor:create", "monitor:read", "monitor:update", "monitor:delete", "monitor:pause",
    "monitor_group:create", "monitor_group:read", "monitor_group:update", "monitor_group:delete",
    "probe:read",

    # --- Incidents ---
    "incident:create", "incident:read", "incident:update", "incident:delete",
    "incident:acknowledge", "incident:resolve", "incident:assign", "incident:postmortem",
    "incident_state:create", "incident_state:read", "incident_state:update", "incident_state:delete",
    "incident_severity:create", "incident_severity:read", "incident_severity:update", "incident_severity:delete",

    # --- Status Pages ---
    "status_page:create", "status_page:read", "status_page:update", "status_page:delete",
    "status_page:publish", "status_page:manage_subscribers",

    # --- Scheduled Maintenance ---
    "scheduled_maintenance:create", "scheduled_maintenance:read",
    "scheduled_maintenance:update", "scheduled_maintenance:delete",

    # --- Webhooks ---
    "webhook:create", "webhook:read", "webhook:update", "webhook:delete", "webhook:test",

    # --- Teams & Users ---
    "team:create", "team:read", "team:update", "team:delete", "team:manage_members",
    "user:read", "user:invite", "user:deactivate", "user:change_role",

    # --- Project & Tenant ---
    "project:create", "project:read", "project:update", "project:delete", "project:manage_sso",
    "tenant:read", "tenant:update",

    # --- RBAC meta (roles, teams, policies) ---
    "role:create", "role:read", "role:update", "role:delete",
    "rbac:read", "rbac:manage",

    # --- API Keys ---
    "api_key:create", "api_key:read", "api_key:revoke",

    # --- Audit & Retention ---
    "audit_log:read", "audit_log:export", "audit_log:verify",
    "retention_policy:read", "retention_policy:update",

    # --- Admin (super-admin only) ---
    "admin:tenants", "admin:impersonate", "admin:system", "admin:cross_tenant_audit",
]

# ------------------------------------------------------------------
# Built-in role permission sets
# ------------------------------------------------------------------

ADMIN_PERMISSIONS = ["*"]

MEMBER_PERMISSIONS = [
    "monitor:create", "monitor:read", "monitor:update", "monitor:pause",
    "monitor_group:create", "monitor_group:read", "monitor_group:update",
    "probe:read",
    "incident:create", "incident:read", "incident:update",
    "incident:acknowledge", "incident:resolve", "incident:assign", "incident:postmortem",
    "incident_state:read", "incident_severity:read",
    "status_page:read", "status_page:update", "status_page:manage_subscribers",
    "scheduled_maintenance:create", "scheduled_maintenance:read", "scheduled_maintenance:update",
    "webhook:read", "webhook:test",
    "team:read",
    "user:read",
    "project:read",
    "tenant:read",
    "role:read",
    "api_key:read",
    "audit_log:read",
    "retention_policy:read",
]

VIEWER_PERMISSIONS = ["*:read"]

SYSTEM_ROLES = {
    "admin":  {"description": "Full access to all project resources.", "permissions": ADMIN_PERMISSIONS},
    "member": {"description": "Standard team member — can create and manage resources, cannot delete.", "permissions": MEMBER_PERMISSIONS},
    "viewer": {"description": "Read-only access to all project resources.", "permissions": VIEWER_PERMISSIONS},
}

# ------------------------------------------------------------------
# Default incident states (ordered)
# ------------------------------------------------------------------

DEFAULT_INCIDENT_STATES = [
    {"name": "triggered",     "color": "#ef4444", "order": 1, "is_resolved_state": False},
    {"name": "investigating", "color": "#f97316", "order": 2, "is_resolved_state": False},
    {"name": "acknowledged",  "color": "#eab308", "order": 3, "is_resolved_state": False},
    {"name": "monitoring",    "color": "#3b82f6", "order": 4, "is_resolved_state": False},
    {"name": "resolved",      "color": "#22c55e", "order": 5, "is_resolved_state": True},
]

# ------------------------------------------------------------------
# Default incident severities (ordered, most critical first)
# ------------------------------------------------------------------

DEFAULT_INCIDENT_SEVERITIES = [
    {"name": "critical", "color": "#dc2626", "order": 1},
    {"name": "high",     "color": "#ea580c", "order": 2},
    {"name": "medium",   "color": "#ca8a04", "order": 3},
    {"name": "low",      "color": "#2563eb", "order": 4},
    {"name": "info",     "color": "#6b7280", "order": 5},
]

# ------------------------------------------------------------------
# Default probe locations created per project (simulated in PoC)
# ------------------------------------------------------------------

DEFAULT_PROBE_LOCATIONS = [
    {"name": "US East",       "location": "us-east-1"},
    {"name": "EU West",       "location": "eu-west-1"},
    {"name": "AP Southeast",  "location": "ap-southeast-1"},
]
