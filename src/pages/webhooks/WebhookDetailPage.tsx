import { useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { webhooksApi } from '@/api/webhooks'
import { Badge } from '@/components/ui/Badge'
import { TeamBadge } from '@/components/ui/TeamBadge'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { TeamSelect } from '@/components/ui/TeamSelect'
import { DetailPageLayout } from '@/components/layout/DetailPageLayout'
import { DetailSectionMenu } from '@/components/layout/DetailSectionMenu'
import { IconGrid, IconBell } from '@/components/ui/Icons'
import { formatDate } from '@/utils/format'
import { teamIdPayload } from '@/utils/teamParams'
import type { Webhook } from '@/types'

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
  { value: 'discord', label: 'Discord Webhook' },
] as const

function WebhookEditForm({ webhook, onClose }: { webhook: Webhook; onClose: () => void }) {
  const qc = useQueryClient()
  const [teamId, setTeamId] = useState(webhook.team_id ?? '')
  const [form, setForm] = useState({
    name: webhook.name,
    url: webhook.url,
    payload_format: webhook.payload_format || 'json' as 'json' | 'slack' | 'teams' | 'discord',
    event_types: [...webhook.event_types],
    is_active: webhook.is_active,
  })
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: () => webhooksApi.update(webhook.id, {
      name: form.name,
      url: form.url,
      event_types: form.event_types,
      payload_format: form.payload_format,
      is_active: form.is_active,
      ...teamIdPayload(teamId),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['webhook', webhook.id] })
      qc.invalidateQueries({ queryKey: ['webhooks'] })
      onClose()
    },
    onError: (err: any) => {
      setError(err.response?.data?.errors?.[0]?.message || err.response?.data?.detail || 'Error updating webhook.')
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
          className="input-field" />
      </div>
      <div>
        <label className="label">URL</label>
        <input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
          className="input-field" />
      </div>
      <div>
        <label className="label">Payload format</label>
        <select value={form.payload_format}
          onChange={e => setForm(f => ({ ...f, payload_format: e.target.value as typeof form.payload_format }))}
          className="input-field">
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
                className="rounded border-gray-300 text-brand-600" />
              <span className="text-sm text-gray-700 font-mono break-all">{ev}</span>
            </label>
          ))}
        </div>
      </div>
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={form.is_active}
          onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
          className="rounded border-gray-300 text-brand-600" />
        <span className="text-sm text-gray-700">Active</span>
      </label>
      <TeamSelect value={teamId} onChange={setTeamId} />
      {error && <p className="form-error">{error}</p>}
      <div className="form-actions">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={() => mutation.mutate()}
          disabled={mutation.isPending || !form.name || !form.url || form.event_types.length === 0}>
          {mutation.isPending ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </div>
  )
}

const statusColor: Record<string, string> = {
  success: 'bg-emerald-100 text-emerald-700',
  failed: 'bg-red-100 text-red-700',
  pending: 'bg-blue-100 text-blue-700',
  exhausted: 'bg-gray-100 text-gray-500',
}

export default function WebhookDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const view = searchParams.get('view') || 'overview'
  const basePath = `/webhooks/${id}`
  const qc = useQueryClient()
  const [showEdit, setShowEdit] = useState(false)

  const { data: webhook, isLoading } = useQuery({
    queryKey: ['webhook', id],
    queryFn: () => webhooksApi.get(id!).then(r => r.data),
    enabled: !!id,
  })

  const { data: deliveries, isLoading: loadingDeliveries } = useQuery({
    queryKey: ['webhook-deliveries', id],
    queryFn: () => webhooksApi.deliveries(id!).then(r => r.data),
    enabled: !!id && view === 'deliveries',
  })

  const retryMutation = useMutation({
    mutationFn: (deliveryId: string) => webhooksApi.retry(id!, deliveryId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['webhook-deliveries', id] }),
  })

  const deleteMutation = useMutation({
    mutationFn: () => webhooksApi.delete(id!),
    onSuccess: () => { window.location.href = '/webhooks' },
  })

  if (isLoading) return <Spinner label="Loading…" />
  if (!webhook) return null

  return (
    <>
      <DetailPageLayout
        embedded
        breadcrumbs={[
          { label: 'Webhooks', to: '/webhooks' },
          { label: webhook.name },
        ]}
        title={webhook.name}
        subtitle={<span className="font-mono text-sm break-all">{webhook.url}</span>}
        badges={
          <>
            <Badge label={webhook.is_active ? 'Active' : 'Inactive'} />
            <TeamBadge teamId={webhook.team_id} teamName={webhook.team_name} />
          </>
        }
        actions={
          <>
            <Button variant="secondary" onClick={() => setShowEdit(true)}>Edit</Button>
            <Button variant="danger" onClick={() => { if (confirm('Delete this webhook?')) deleteMutation.mutate() }}>
              Delete
            </Button>
          </>
        }
        sideMenu={
          <DetailSectionMenu
            basePath={basePath}
            defaultView="overview"
            sections={[
              {
                title: 'Webhook',
                items: [
                  { id: 'overview', label: 'Overview', icon: <IconGrid /> },
                  { id: 'deliveries', label: 'Deliveries', icon: <IconBell /> },
                ],
              },
            ]}
          />
        }
      >
        {view === 'deliveries' ? (
          <div className="card p-4 sm:p-5">
            <h3 className="section-title mb-4">Delivery history (last 100)</h3>
            {loadingDeliveries ? (
              <Spinner size="sm" />
            ) : !deliveries || deliveries.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No deliveries yet.</p>
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {deliveries.map(d => (
                  <div key={d.id} className="flex items-start justify-between py-2 border-b border-gray-50 last:border-0 gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColor[d.status] ?? 'bg-gray-100 text-gray-500'}`}>
                          {d.status}
                        </span>
                        <span className="text-xs text-gray-500 font-mono">{d.event}</span>
                      </div>
                      <p className="text-xs text-gray-400">
                        {d.response_status ? `HTTP ${d.response_status}` : '—'} · Attempt {d.attempt} · {formatDate(d.created_at)}
                      </p>
                    </div>
                    {(d.status === 'failed' || d.status === 'exhausted') && (
                      <button onClick={() => retryMutation.mutate(d.id)}
                        disabled={retryMutation.isPending}
                        className="btn-ghost btn-sm text-brand-600 shrink-0 disabled:opacity-50">
                        Retry
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="card p-4 sm:p-5 space-y-4">
            <h3 className="text-sm font-semibold text-gray-700">Details</h3>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Created on</p>
              <p className="text-sm text-gray-700">{formatDate(webhook.created_at)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Payload format</p>
              <p className="text-sm text-gray-700 capitalize">{webhook.payload_format || 'json'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Events ({webhook.event_types.length})</p>
              <div className="flex flex-wrap gap-1">
                {webhook.event_types.map(ev => (
                  <span key={ev} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-mono">{ev}</span>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Secret</p>
              <p className="text-sm text-gray-700 font-mono">{webhook.secret ? '••••••••' : '—'}</p>
            </div>
          </div>
        )}
      </DetailPageLayout>

      <Modal open={showEdit} onClose={() => setShowEdit(false)} title="Edit webhook" size="lg">
        <WebhookEditForm webhook={webhook} onClose={() => setShowEdit(false)} />
      </Modal>
    </>
  )
}
