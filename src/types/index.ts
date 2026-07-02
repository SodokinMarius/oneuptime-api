// ─── Team scoping (Option A) ─────────────────────────────────────────────────

export interface TeamScoped {
  team_id: string | null
  team_name: string | null
}

// ─── Monitor ─────────────────────────────────────────────────────────────────

export type MonitorType =
  | 'api' | 'website' | 'tcp' | 'heartbeat' | 'ping'
  | 'dns' | 'udp' | 'ssl' | 'multi_step_api' | 'journey'

export type MonitorStatus = 'operational' | 'degraded' | 'offline' | 'disabled'

export interface MonitorStepAssert {
  status?: number
  body_contains?: string
}

export interface MonitorStep {
  name?: string
  url: string
  method?: string
  headers?: Record<string, string>
  body?: string
  assert?: MonitorStepAssert
  extract?: Record<string, string>
}

export interface Monitor extends TeamScoped {
  id: string
  name: string
  type: MonitorType
  url: string
  method: string
  interval_seconds: number
  timeout_seconds: number
  retries: number
  is_paused: boolean
  status: MonitorStatus
  tags: string[]
  alert_on_failure: boolean
  criteria?: Record<string, unknown>
  steps?: MonitorStep[]
  last_check_at: string | null
  next_check_at: string | null
  current_incident: string | null
  created_at: string
  updated_at: string
}

export interface MonitorCheck {
  id: string
  monitor: string
  probe: string | null
  checked_at: string
  status: 'success' | 'failure' | 'timeout' | 'error'
  response_status_code: number | null
  response_time_ms: number | null
  error_message: string | null
  triggered_incident: string | null
}

export interface UptimeStats {
  uptime_percent: number | null
  total_checks: number
  failed_checks: number
  successful_checks: number
  period: { from: string; to: string; days: number }
}

export interface MonitorGroup extends TeamScoped {
  id: string
  name: string
  description: string
  monitors: string[]
  monitor_count: number
  created_at: string
  updated_at: string
}

// ─── Incident ────────────────────────────────────────────────────────────────

export type IncidentSeverity = 'critical' | 'high' | 'medium' | 'low'

export interface IncidentEscalationState {
  policy: string
  policy_name: string
  current_step_order: number
  last_escalated_at: string | null
  completed: boolean
}

export interface Incident extends TeamScoped {
  id: string
  title: string
  description: string
  state: string | null
  state_name: string | null
  severity: string | null
  severity_name: string | null
  is_resolved: boolean
  monitor: string | null
  assigned_to: string | null
  is_visible_on_status_page: boolean
  escalation_state?: IncidentEscalationState | null
  triggered_at: string
  acknowledged_at: string | null
  resolved_at: string | null
  created_at: string
  updated_at: string
}

export interface IncidentNote {
  id: string
  content: string
  is_public: boolean
  /** @deprecated use is_public — kept for backward compat in UI */
  is_internal?: boolean
  author_email?: string
  author?: { id: string; email: string; full_name: string }
  created_at: string
  updated_at?: string
}

export interface IncidentState {
  id: string
  name: string
  color: string
  order: number
  is_system: boolean
}

export interface IncidentSeverityObj {
  id: string
  name: string
  color: string
  order: number
  is_system: boolean
}

// ─── Maintenance ─────────────────────────────────────────────────────────────

export type MaintenanceStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
export type RecurrenceFrequency = 'none' | 'daily' | 'weekly' | 'monthly'

export interface Maintenance extends TeamScoped {
  id: string
  title: string
  description: string
  status: MaintenanceStatus
  starts_at: string
  ends_at: string
  monitors: string[]
  is_visible_on_status_page: boolean
  notify_subscribers: boolean
  recurrence_frequency: RecurrenceFrequency
  recurrence_interval: number
  recurrence_weekdays: number[]
  recurrence_until: string | null
  series_id: string | null
  created_at: string
  updated_at: string
}

// ─── Status Pages ─────────────────────────────────────────────────────────────

export interface StatusPage extends TeamScoped {
  id: string
  name: string
  slug: string
  description: string
  is_public: boolean
  logo_url: string | null
  primary_color: string
  custom_css: string
  custom_domain: string | null
  subscribers_count?: number
  created_at: string
  updated_at: string
}

// ─── Webhooks ─────────────────────────────────────────────────────────────────

export type WebhookPayloadFormat = 'json' | 'slack' | 'teams'

export interface Webhook extends TeamScoped {
  id: string
  name: string
  url: string
  payload_format: WebhookPayloadFormat
  event_types: string[]
  is_active: boolean
  secret: string
  timeout_seconds: number
  max_retries: number
  created_at: string
  updated_at: string
}

// ─── Incident automation ───────────────────────────────────────────────────────

export type EscalationAction =
  | 'notify_webhook'
  | 'notify_user'
  | 'increase_severity'
  | 'assign_user'

export interface EscalationStep {
  id: string
  order: number
  delay_minutes: number
  action: EscalationAction
  webhook: string | null
  user: string | null
  target_severity: string | null
  created_at: string
}

export interface EscalationPolicy extends TeamScoped {
  id: string
  name: string
  description: string
  is_default: boolean
  is_active: boolean
  severity_names: string[]
  steps: EscalationStep[]
  step_count: number
  created_at: string
  updated_at: string
}

export type IncidentWorkflowTrigger =
  | 'incident_created'
  | 'incident_unacknowledged'
  | 'incident_resolved'

export interface IncidentWorkflowRule {
  id: string
  name: string
  trigger: IncidentWorkflowTrigger
  conditions: Record<string, unknown>
  actions: Record<string, unknown>[]
  is_active: boolean
  created_at: string
  updated_at: string
}

// ─── Pagination ───────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}
