import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { webhooksApi } from '@/api/webhooks'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'
import { IconBell } from '@/components/ui/Icons'
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
        <label className="block text-sm font-medium text-gray-700 mb-1">Nom</label>
        <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Mon webhook" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">URL</label>
        <input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="https://exemple.com/webhook" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Secret HMAC <span className="text-gray-400 font-normal">(optionnel)</span></label>
        <input value={form.secret} onChange={e => setForm(f => ({ ...f, secret: e.target.value }))}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
          placeholder="Auto-généré si vide" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Événements</label>
        <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-3">
          {ALL_EVENTS.map(ev => (
            <label key={ev} className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.event_types.includes(ev)} onChange={() => toggleEvent(ev)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
              <span className="text-sm text-gray-700 font-mono">{ev}</span>
            </label>
          ))}
        </div>
      </div>
      <TeamSelect value={teamId} onChange={setTeamId} />
      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
      <div className="flex justify-end gap-2 pt-2">
        <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors">Annuler</button>
        <button onClick={() => mutation.mutate()} disabled={mutation.isPending || !form.name || !form.url || form.event_types.length === 0}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm rounded-lg transition-colors">
          {mutation.isPending ? 'Création...' : 'Créer le webhook'}
        </button>
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
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Webhooks</h2>
          <p className="text-gray-500 text-sm mt-1">Notifications sortantes signées HMAC-SHA256</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors w-full sm:w-auto">
          + Nouveau webhook
        </button>
      </div>

      <div className="mb-6">
        <TeamFilter value={teamFilter} onChange={setTeamFilter} />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : webhooks.length === 0 ? (
        <EmptyState icon={<IconBell size={24} />} title="Aucun webhook"
          description="Créez un webhook pour recevoir des notifications en temps réel."
          action={<button onClick={() => setShowCreate(true)} className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">+ Nouveau webhook</button>} />
      ) : (
        <div className="space-y-3">
          {webhooks.map(wh => (
            <div key={wh.id} className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
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
                <span className="text-xs text-gray-400 mr-1">{formatRelative(wh.created_at)}</span>
                <Link to={`/webhooks/${wh.id}`}
                  className="text-sm text-blue-600 hover:underline px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors border border-blue-100">
                  Détails
                </Link>
                <button onClick={() => { if (confirm('Supprimer ce webhook ?')) deleteMutation.mutate(wh.id) }}
                  className="text-sm text-red-500 hover:text-red-700 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors border border-red-100">
                  Supprimer
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Nouveau webhook" size="lg">
        <WebhookForm onClose={() => setShowCreate(false)} />
      </Modal>
    </div>
  )
}
