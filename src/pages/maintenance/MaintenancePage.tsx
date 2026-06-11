import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { maintenanceApi } from '@/api/maintenance'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatDate } from '@/utils/format'
import { IconWrench } from '@/components/ui/Icons'
import { TeamBadge } from '@/components/ui/TeamBadge'
import { TeamFilter } from '@/components/ui/TeamFilter'
import { TeamSelect } from '@/components/ui/TeamSelect'
import { teamIdPayload, withTeamFilter } from '@/utils/teamParams'

function MaintenanceForm({ onSuccess }: { onSuccess: () => void }) {
  const [teamId, setTeamId] = useState('')
  const [form, setForm] = useState({ title: '', description: '', starts_at: '', ends_at: '' })
  const [error, setError] = useState('')

  const mut = useMutation({
    mutationFn: () => maintenanceApi.create({ ...form, ...teamIdPayload(teamId) }),
    onSuccess,
    onError: (err: any) => {
      const d = err.response?.data
      if (d?.errors?.length) {
        setError(d.errors.map((e: any) => e.field ? `${e.field} : ${e.message}` : e.message).join('\n'))
      } else if (d?.detail) {
        setError(d.detail)
      } else if (typeof d === 'object') {
        setError(Object.entries(d).map(([k, v]) => `${k} : ${Array.isArray(v) ? v.join(', ') : v}`).join('\n'))
      } else {
        setError('Une erreur est survenue.')
      }
    },
  })

  return (
    <form onSubmit={e => { e.preventDefault(); setError(''); mut.mutate() }} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Titre *</label>
        <input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Mise à jour base de données" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <textarea rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          placeholder="Décrivez la maintenance..." />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Début *</label>
          <input required type="datetime-local" value={form.starts_at}
            onChange={e => setForm({ ...form, starts_at: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Fin *</label>
          <input required type="datetime-local" value={form.ends_at}
            onChange={e => setForm({ ...form, ends_at: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>
      <TeamSelect value={teamId} onChange={setTeamId} />
      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>}
      <div className="flex justify-end pt-1">
        <button type="submit" disabled={mut.isPending}
          className="bg-yellow-500 hover:bg-yellow-600 disabled:opacity-50 text-white font-medium px-5 py-2 rounded-lg text-sm transition-colors">
          {mut.isPending ? 'Planification...' : 'Planifier'}
        </button>
      </div>
    </form>
  )
}

export default function MaintenancePage() {
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [teamFilter, setTeamFilter] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['maintenance', teamFilter],
    queryFn: () => maintenanceApi.list(withTeamFilter({}, teamFilter)).then(r => r.data),
  })

  const cancelMut = useMutation({
    mutationFn: (id: string) => maintenanceApi.cancel(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['maintenance'] }),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => maintenanceApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['maintenance'] }),
  })

  const items = data?.results ?? []

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Maintenance planifiée</h2>
          <p className="text-sm text-gray-500 mt-0.5">{data?.count ?? 0} fenêtre{(data?.count ?? 0) > 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="bg-yellow-500 hover:bg-yellow-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors w-full sm:w-auto">
          + Planifier une maintenance
        </button>
      </div>

      <div className="mb-6">
        <TeamFilter value={teamFilter} onChange={setTeamFilter} />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon={<IconWrench size={24} />} title="Aucune maintenance planifiée"
          description="Planifiez vos fenêtres de maintenance pour suspendre les alertes."
          action={
            <button onClick={() => setShowCreate(true)}
              className="bg-yellow-500 text-white text-sm px-4 py-2 rounded-lg">
              Planifier
            </button>
          }
        />
      ) : (
        <div className="space-y-3">
          {items.map(m => (
            <div key={m.id} className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <Badge label={m.status} />
                    <TeamBadge teamId={m.team_id} teamName={m.team_name} />
                  </div>
                  <h3 className="font-semibold text-gray-900">{m.title}</h3>
                  {m.description && <p className="text-sm text-gray-500 mt-1">{m.description}</p>}
                  <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-400">
                    <span>🕐 Début : {formatDate(m.starts_at)}</span>
                    <span>🕑 Fin : {formatDate(m.ends_at)}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 sm:shrink-0">
                  {m.status === 'scheduled' && (
                    <button onClick={() => cancelMut.mutate(m.id)} disabled={cancelMut.isPending}
                      className="text-xs border border-orange-200 text-orange-600 px-2.5 py-1 rounded-lg hover:bg-orange-50 transition-colors">
                      Annuler
                    </button>
                  )}
                  <button onClick={() => { if (confirm('Supprimer ?')) deleteMut.mutate(m.id) }}
                    className="text-xs border border-red-200 text-red-500 px-2.5 py-1 rounded-lg hover:bg-red-50 transition-colors">
                    Suppr.
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Planifier une maintenance">
        <MaintenanceForm onSuccess={() => { setShowCreate(false); qc.invalidateQueries({ queryKey: ['maintenance'] }) }} />
      </Modal>
    </div>
  )
}
