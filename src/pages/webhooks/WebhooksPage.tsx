import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { webhooksApi } from '@/api/webhooks'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageShell } from '@/components/ui/PageShell'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { IconBell, IconPlus } from '@/components/ui/Icons'
import { Badge } from '@/components/ui/Badge'
import { TeamBadge } from '@/components/ui/TeamBadge'
import { TeamFilter } from '@/components/ui/TeamFilter'
import { TeamSelect } from '@/components/ui/TeamSelect'
import { teamIdPayload, withTeamFilter } from '@/utils/teamParams'
import { formatRelative } from '@/utils/format'

const ALL_EVENTS = [
  'incident.created', 'incident.acknowledged', 'incident.resolved', 'incident.assigned',
  'incident.escalated', 'incident.workflow',
  'incident.note_added', 'incident.postmortem_published',
  'scheduled_maintenance.created', 'scheduled_maintenance.started', 'scheduled_maintenance.ended',
  'monitor.status_changed',
]

const PAYLOAD_FORMATS = [
  { value: 'json', label: 'JSON (default)' },
  { value: 'slack', label: 'Slack Incoming Webhook' },
  { value: 'teams', label: 'Microsoft Teams Connector' },
] as const

function WebhookForm({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [teamId, setTeamId] = useState('')
  const [form, setForm] = useState({
    name: '',
    url: '',
    secret: '',
    payload_format: 'json' as 'json' | 'slack' | 'teams',
    event_types: [] as string[],
  })
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: () => webhooksApi.create({
      name: form.name,
      url: form.url,
      event_types: form.event_types,
      secret: form.secret || undefined,
      payload_format: form.payload_format,
      ...teamIdPayload(teamId),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['webhooks'] }); onClose() },
    onError: (err: any) => {
      const msg = err.response?.data?.errors?.[0]?.message || err.response?.data?.detail || 'Error creating webhook.'
      setError(msg)
    },
  })

  const toggleEvent = (ev: string) =>
    setForm(f => ({
      ...f,
      event_types: f.event_types.includes(ev)
        ? f.event_types.filter(e => e !== ev)
        : [...f.event_types, ev],
    }))

  return (
    <div className="space-y-4">
      <div>
        <label className="label">Name</label>
        <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          className="input-field" placeholder="My webhook" />
      </div>
      <div>
        <label className="label">URL</label>
        <input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
          className="input-field" placeholder="https://example.com/webhook" />
      </div>
      <div>
        <label className="label">Secret HMAC <span className="text-gray-400 font-normal">(optional)</span></label>
        <input value={form.secret} onChange={e => setForm(f => ({ ...f, secret: e.target.value }))}
          className="input-field font-mono" placeholder="Auto-generated if empty" />
      </div>
      <div>
        <label className="label">Payload format</label>
        <select
          value={form.payload_format}
          onChange={e => setForm(f => ({ ...f, payload_format: e.target.value as typeof form.payload_format }))}
          className="input-field"
        >
          {PAYLOAD_FORMATS.map(fmt => (
            <option key={fmt.value} value={fmt.value}>{fmt.label}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Events</label>
        <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-3">
          {ALL_EVENTS.map(ev => (
            <label key={ev} className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.event_types.includes(ev)} onChange={() => toggleEvent(ev)}
                className="rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
              <span className="text-sm text-gray-700 font-mono break-all">{ev}</span>
            </label>
          ))}
        </div>
      </div>
      <TeamSelect value={teamId} onChange={setTeamId} />
      {error && <p className="form-error">{error}</p>}
      <div className="form-actions">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending || !form.name || !form.url || form.event_types.length === 0}
        >
          {mutation.isPending ? 'Creating…' : 'Create webhook'}
        </Button>
      </div>
    </div>
  )
}

export default function WebhooksPage() {
  const [showCreate, setShowCreate] = useState(false)
  const [teamFilter, setTeamFilter] = useState('')
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['webhooks', teamFilter],
    queryFn: () => webhooksApi.list(withTeamFilter({}, teamFilter)).then(r => r.data),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => webhooksApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['webhooks'] }),
  })

  const webhooks = data?.results ?? []

  return (
    <PageShell>
      <PageHeader
        title="Webhooks"
        subtitle="Outgoing HMAC-SHA256 signed notifications"
        actions={
          <Button onClick={() => setShowCreate(true)} fullWidth>
            <IconPlus size={16} />
            New webhook
          </Button>
        }
      />

      <div className="filter-bar">
        <TeamFilter value={teamFilter} onChange={setTeamFilter} />
      </div>

      {isLoading ? (
        <Spinner label="Loading…" />
      ) : webhooks.length === 0 ? (
        <EmptyState
          icon={<IconBell size={24} />}
          title="No webhooks"
          description="Create a webhook to receive real-time notifications."
          action={
            <Button onClick={() => setShowCreate(true)}>
              <IconPlus size={16} />
              New webhook
            </Button>
          }
        />
      ) : (
        <div className="card-list">
          {webhooks.map(wh => (
            <div key={wh.id} className="card-item flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="font-semibold text-gray-900">{wh.name}</span>
                  <Badge label={wh.is_active ? 'Active' : 'Inactive'} />
                  <TeamBadge teamId={wh.team_id} teamName={wh.team_name} />
                </div>
                <p className="text-sm text-gray-500 font-mono truncate mb-2">{wh.url}</p>
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-medium capitalize">
                    {wh.payload_format || 'json'}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {wh.event_types.slice(0, 4).map(ev => (
                    <span key={ev} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-mono">{ev}</span>
                  ))}
                  {wh.event_types.length > 4 && (
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">+{wh.event_types.length - 4}</span>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                <span className="text-xs text-gray-400">{formatRelative(wh.created_at)}</span>
                <Link to={`/webhooks/${wh.id}`} className="btn-secondary btn-sm">Details</Link>
                <Button variant="danger" size="sm" onClick={() => { if (confirm('Delete this webhook?')) deleteMutation.mutate(wh.id) }}>
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New webhook" size="lg">
        <WebhookForm onClose={() => setShowCreate(false)} />
      </Modal>
    </PageShell>
  )
}
