import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { monitorsApi } from '@/api/monitors'
import { TeamSelect } from '@/components/ui/TeamSelect'
import type { Monitor, MonitorStep, MonitorType } from '@/types'
import { teamIdPayload } from '@/utils/teamParams'

interface Props {
  monitor?: Monitor
  onSuccess: () => void
}

const MONITOR_TYPE_OPTIONS: { value: MonitorType; label: string }[] = [
  { value: 'website', label: 'Website' },
  { value: 'api', label: 'API / HTTP' },
  { value: 'tcp', label: 'TCP Port' },
  { value: 'udp', label: 'UDP Port' },
  { value: 'dns', label: 'DNS' },
  { value: 'ssl', label: 'SSL Certificate' },
  { value: 'ping', label: 'Ping (ICMP)' },
  { value: 'multi_step_api', label: 'Multi-step API' },
  { value: 'journey', label: 'User Journey' },
  { value: 'heartbeat', label: 'Heartbeat' },
]

const STEPS_PLACEHOLDER = `[
  {
    "name": "Homepage",
    "url": "https://example.com",
    "method": "GET",
    "assert": { "status": 200 }
  },
  {
    "name": "API health",
    "url": "https://api.example.com/health",
    "method": "GET",
    "assert": { "status": 200, "body_contains": "ok" }
  }
]`

function buildCriteria(type: MonitorType, fields: {
  dns_record_type: string
  dns_expected: string
  ssl_min_days: number
  udp_payload: string
  udp_expect_response: boolean
  journey_think_time_ms: number
}): Record<string, unknown> {
  switch (type) {
    case 'dns':
      return {
        record_type: fields.dns_record_type,
        ...(fields.dns_expected
          ? { expected_values: fields.dns_expected.split(',').map(s => s.trim()).filter(Boolean) }
          : {}),
      }
    case 'ssl':
      return { min_days_before_expiry: fields.ssl_min_days }
    case 'udp':
      return {
        payload: fields.udp_payload || 'ping',
        expect_response: fields.udp_expect_response,
      }
    case 'journey':
      return { think_time_ms: fields.journey_think_time_ms }
    default:
      return {}
  }
}

function parseSteps(json: string): MonitorStep[] {
  if (!json.trim()) return []
  const parsed = JSON.parse(json)
  if (!Array.isArray(parsed)) throw new Error('Steps must be a JSON array.')
  return parsed
}

function initialForm(monitor?: Monitor) {
  const criteria = monitor?.criteria ?? {}
  return {
    name: monitor?.name ?? '',
    type: (monitor?.type ?? 'website') as MonitorType,
    url: monitor?.url ?? '',
    method: monitor?.method ?? 'GET',
    interval_seconds: monitor?.interval_seconds ?? 60,
    timeout_seconds: monitor?.timeout_seconds ?? 30,
    retries: monitor?.retries ?? 3,
    alert_on_failure: monitor?.alert_on_failure ?? true,
    dns_record_type: String(criteria.record_type ?? 'A'),
    dns_expected: Array.isArray(criteria.expected_values)
      ? (criteria.expected_values as string[]).join(', ')
      : '',
    ssl_min_days: Number(criteria.min_days_before_expiry ?? 14),
    udp_payload: String(criteria.payload ?? 'ping'),
    udp_expect_response: Boolean(criteria.expect_response),
    journey_think_time_ms: Number(criteria.think_time_ms ?? 500),
    steps_json: monitor?.steps?.length
      ? JSON.stringify(monitor.steps, null, 2)
      : '',
  }
}

export default function MonitorForm({ monitor, onSuccess }: Props) {
  const isEdit = Boolean(monitor)
  const [teamId, setTeamId] = useState(monitor?.team_id ?? '')
  const [form, setForm] = useState(() => initialForm(monitor))
  const [error, setError] = useState('')

  const mut = useMutation({
    mutationFn: () => {
      let steps: MonitorStep[] | undefined
      if (form.type === 'multi_step_api' || form.type === 'journey') {
        steps = parseSteps(form.steps_json)
        if (!steps.length) throw new Error('At least one step is required.')
      }

      const criteria = buildCriteria(form.type, form)
      const payload: Record<string, unknown> = {
        name: form.name,
        type: form.type,
        interval_seconds: form.interval_seconds,
        timeout_seconds: form.timeout_seconds,
        retries: form.retries,
        alert_on_failure: form.alert_on_failure,
        ...teamIdPayload(teamId),
      }

      if (form.type !== 'heartbeat') {
        payload.url = form.url
      }
      if (['api', 'website', 'multi_step_api', 'journey'].includes(form.type)) {
        payload.method = form.method
      }
      if (Object.keys(criteria).length) payload.criteria = criteria
      if (steps) payload.steps = steps

      return isEdit && monitor
        ? monitorsApi.update(monitor.id, payload)
        : monitorsApi.create(payload)
    },
    onSuccess,
    onError: (err: any) => {
      if (err?.message && !err?.response) {
        setError(err.message)
        return
      }
      const data = err.response?.data
      if (data?.errors?.length) {
        const msgs = data.errors.map((e: any) =>
          e.field ? `${e.field} : ${e.message}` : e.message
        ).join('\n')
        setError(msgs)
      } else if (data?.detail) {
        setError(data.detail)
      } else if (typeof data === 'object') {
        const msgs = Object.entries(data).map(([k, v]) => `${k} : ${Array.isArray(v) ? v.join(', ') : v}`).join('\n')
        setError(msgs)
      } else {
        setError('An error occurred.')
      }
    },
  })

  const needsUrl = !['heartbeat'].includes(form.type)
  const needsMethod = ['api', 'website'].includes(form.type)
  const needsSteps = ['multi_step_api', 'journey'].includes(form.type)

  const urlLabel = (() => {
    switch (form.type) {
      case 'tcp': return 'Target (host:port) *'
      case 'udp': return 'Target (host:port) *'
      case 'dns': return 'Hostname *'
      case 'ssl': return 'Hostname (optional :port) *'
      case 'ping': return 'Host *'
      case 'multi_step_api':
      case 'journey': return 'Base URL (optional)'
      default: return 'URL *'
    }
  })()

  const urlPlaceholder = (() => {
    switch (form.type) {
      case 'tcp':
      case 'udp': return 'example.com:443'
      case 'dns': return 'example.com'
      case 'ssl': return 'example.com:443'
      case 'ping': return '8.8.8.8'
      default: return 'https://example.com'
    }
  })()

  return (
    <form onSubmit={e => {
      e.preventDefault()
      setError('')
      try {
        mut.mutate()
      } catch (err: any) {
        setError(err.message || 'Invalid configuration.')
      }
    }} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="label">Name *</label>
          <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
            className="input-field"
            placeholder="Production API" />
        </div>

        <div>
          <label className="label">Type *</label>
          <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value as MonitorType })}
            className="input-field" disabled={isEdit}>
            {MONITOR_TYPE_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {needsMethod && (
          <div>
            <label className="label">HTTP method</label>
            <select value={form.method} onChange={e => setForm({ ...form, method: e.target.value })}
              className="input-field">
              {['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'].map(m => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </div>
        )}

        {needsUrl && (
          <div className="sm:col-span-2">
            <label className="label">{urlLabel}</label>
            <input
              required={needsUrl && form.type !== 'multi_step_api' && form.type !== 'journey'}
              value={form.url}
              onChange={e => setForm({ ...form, url: e.target.value })}
              className="input-field"
              placeholder={urlPlaceholder}
            />
          </div>
        )}

        {form.type === 'dns' && (
          <>
            <div>
              <label className="label">Record type</label>
              <select value={form.dns_record_type} onChange={e => setForm({ ...form, dns_record_type: e.target.value })}
                className="input-field">
                {['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS'].map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Expected values <span className="text-gray-400 font-normal">(comma-separated)</span></label>
              <input value={form.dns_expected} onChange={e => setForm({ ...form, dns_expected: e.target.value })}
                className="input-field" placeholder="1.2.3.4, 5.6.7.8" />
            </div>
          </>
        )}

        {form.type === 'ssl' && (
          <div>
            <label className="label">Min days before expiry</label>
            <input type="number" min={1} max={365} value={form.ssl_min_days}
              onChange={e => setForm({ ...form, ssl_min_days: +e.target.value })}
              className="input-field" />
          </div>
        )}

        {form.type === 'udp' && (
          <>
            <div>
              <label className="label">UDP payload</label>
              <input value={form.udp_payload} onChange={e => setForm({ ...form, udp_payload: e.target.value })}
                className="input-field font-mono" placeholder="ping" />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <input type="checkbox" id="udp_expect" checked={form.udp_expect_response}
                onChange={e => setForm({ ...form, udp_expect_response: e.target.checked })}
                className="rounded" />
              <label htmlFor="udp_expect" className="text-sm text-gray-700">Expect a response</label>
            </div>
          </>
        )}

        {form.type === 'journey' && (
          <div>
            <label className="label">Think time between steps (ms)</label>
            <input type="number" min={0} max={60000} value={form.journey_think_time_ms}
              onChange={e => setForm({ ...form, journey_think_time_ms: +e.target.value })}
              className="input-field" />
          </div>
        )}

        {needsSteps && (
          <div className="sm:col-span-2">
            <label className="label">Steps (JSON) *</label>
            <textarea
              required
              rows={8}
              value={form.steps_json}
              onChange={e => setForm({ ...form, steps_json: e.target.value })}
              className="input-field font-mono text-xs resize-none"
              placeholder={STEPS_PLACEHOLDER}
            />
            <p className="text-xs text-gray-400 mt-1">
              Use <code className="bg-gray-100 px-1 rounded">assert.status</code> and optional{' '}
              <code className="bg-gray-100 px-1 rounded">assert.body_contains</code> per step.
            </p>
          </div>
        )}

        <div>
          <label className="label">Interval (seconds)</label>
          <input type="number" min={30} max={3600} value={form.interval_seconds}
            onChange={e => setForm({ ...form, interval_seconds: +e.target.value })}
            className="input-field" />
        </div>

        <div>
          <label className="label">Timeout (seconds)</label>
          <input type="number" min={5} max={120} value={form.timeout_seconds}
            onChange={e => setForm({ ...form, timeout_seconds: +e.target.value })}
            className="input-field" />
        </div>

        <div>
          <label className="label">Retries</label>
          <input type="number" min={1} max={10} value={form.retries}
            onChange={e => setForm({ ...form, retries: +e.target.value })}
            className="input-field" />
        </div>

        <div className="flex items-center gap-2 pt-6">
          <input type="checkbox" id="alert" checked={form.alert_on_failure}
            onChange={e => setForm({ ...form, alert_on_failure: e.target.checked })}
            className="rounded" />
          <label htmlFor="alert" className="text-sm text-gray-700">Alert on failure</label>
        </div>

        <div className="sm:col-span-2">
          <TeamSelect value={teamId} onChange={setTeamId} />
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 whitespace-pre-line">
          {error}
        </div>
      )}

      <div className="flex justify-end gap-3 pt-2 sticky bottom-0 bg-white">
        <button type="submit" disabled={mut.isPending}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium px-5 py-2 rounded-lg text-sm transition-colors">
          {mut.isPending ? (isEdit ? 'Saving...' : 'Creating...') : (isEdit ? 'Save changes' : 'Create monitor')}
        </button>
      </div>
    </form>
  )
}
