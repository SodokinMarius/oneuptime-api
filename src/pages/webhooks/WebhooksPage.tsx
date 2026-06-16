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
  'incident.created', 'incident.acknowledged', 'incident.resolved',
  'incident.note_added', 'incident.postmortem_published',
  'scheduled_maintenance.created', 'scheduled_maintenance.started', 'scheduled_maintenance.ended',
  'monitor.status_changed',
]

function WebhookForm({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [teamId, setTeamId] = useState('')
  const [form, setForm] = useState({ name: '', url: '', secret: '', event_types: [] as string[] })
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: () => webhooksApi.create({
      name: form.name,
      url: form.url,
      event_types: form.event_types,
      secret: form.secret || undefined,
      ...teamIdPayload(teamId),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['webhooks'] }); onClose() },
    onError: (err: any) => {
      const msg = err.response?.data?.errors?.[0]?.message || err.response?.data?.detail || 'Erreur lors de la création.'
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
        <label className="label">Nom</label>
        <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          className="input-field" placeholder="Mon webhook" />
      </div>
      <div>
        <label className="label">URL</label>
        <input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
          className="input-field" placeholder="https://exemple.com/webhook" />
      </div>
      <div>
        <label className="label">Secret HMAC <span className="text-gray-400 font-normal">(optionnel)</span></label>
        <input value={form.secret} onChange={e => setForm(f => ({ ...f, secret: e.target.value }))}
          className="input-field font-mono" placeholder="Auto-généré si vide" />
      </div>
      <div>
        <label className="label">Événements</label>
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
        <Button variant="secondary" onClick={onClose}>Annuler</Button>
        <Button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending || !form.name || !form.url || form.event_types.length === 0}
        >
          {mutation.isPending ? 'Création…' : 'Créer le webhook'}
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
        subtitle="Notifications sortantes signées HMAC-SHA256"
        actions={
          <Button onClick={() => setShowCreate(true)} fullWidth>
            <IconPlus size={16} />
            Nouveau webhook
          </Button>
        }
      />

      <div className="filter-bar">
        <TeamFilter value={teamFilter} onChange={setTeamFilter} />
      </div>

      {isLoading ? (
        <Spinner label="Chargement…" />
      ) : webhooks.length === 0 ? (
        <EmptyState
          icon={<IconBell size={24} />}
          title="Aucun webhook"
          description="Créez un webhook pour recevoir des notifications en temps réel."
          action={
            <Button onClick={() => setShowCreate(true)}>
              <IconPlus size={16} />
              Nouveau webhook
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
                  <Badge label={wh.is_active ? 'Actif' : 'Inactif'} />
                  <TeamBadge teamId={wh.team_id} teamName={wh.team_name} />
                </div>
                <p className="text-sm text-gray-500 font-mono truncate mb-2">{wh.url}</p>
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
                <Link to={`/webhooks/${wh.id}`} className="btn-secondary btn-sm">Détails</Link>
                <Button variant="danger" size="sm" onClick={() => { if (confirm('Supprimer ce webhook ?')) deleteMutation.mutate(wh.id) }}>
                  Supprimer
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Nouveau webhook" size="lg">
        <WebhookForm onClose={() => setShowCreate(false)} />
      </Modal>
    </PageShell>
  )
}
