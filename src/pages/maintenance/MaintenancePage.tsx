import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { maintenanceApi } from '@/api/maintenance'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageShell } from '@/components/ui/PageShell'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { formatDate } from '@/utils/format'
import { IconClock, IconPlus, IconWrench } from '@/components/ui/Icons'
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
        <label className="label">Titre *</label>
        <input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
          className="input-field" placeholder="Mise à jour base de données" />
      </div>
      <div>
        <label className="label">Description</label>
        <textarea rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
          className="input-field resize-none" placeholder="Décrivez la maintenance…" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Début *</label>
          <input required type="datetime-local" value={form.starts_at}
            onChange={e => setForm({ ...form, starts_at: e.target.value })}
            className="input-field" />
        </div>
        <div>
          <label className="label">Fin *</label>
          <input required type="datetime-local" value={form.ends_at}
            onChange={e => setForm({ ...form, ends_at: e.target.value })}
            className="input-field" />
        </div>
      </div>
      <TeamSelect value={teamId} onChange={setTeamId} />
      {error && <div className="form-error whitespace-pre-line">{error}</div>}
      <div className="form-actions">
        <Button type="submit" disabled={mut.isPending}>
          {mut.isPending ? 'Planification…' : 'Planifier'}
        </Button>
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
    <PageShell>
      <PageHeader
        title="Maintenance planifiée"
        subtitle={`${data?.count ?? 0} fenêtre${(data?.count ?? 0) > 1 ? 's' : ''}`}
        actions={
          <Button onClick={() => setShowCreate(true)} fullWidth>
            <IconPlus size={16} />
            Planifier une maintenance
          </Button>
        }
      />

      <div className="filter-bar">
        <TeamFilter value={teamFilter} onChange={setTeamFilter} />
      </div>

      {isLoading ? (
        <Spinner label="Chargement…" />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<IconWrench size={24} />}
          title="Aucune maintenance planifiée"
          description="Planifiez vos fenêtres de maintenance pour suspendre les alertes."
          action={<Button onClick={() => setShowCreate(true)}>Planifier</Button>}
        />
      ) : (
        <div className="card-list">
          {items.map(m => (
            <div key={m.id} className="card-item">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <Badge label={m.status} />
                    <TeamBadge teamId={m.team_id} teamName={m.team_name} />
                  </div>
                  <h3 className="font-semibold text-gray-900">{m.title}</h3>
                  {m.description && <p className="text-sm text-gray-500 mt-1">{m.description}</p>}
                  <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:gap-4 mt-2 text-xs text-gray-400">
                    <span className="inline-flex items-center gap-1"><IconClock size={12} /> Début : {formatDate(m.starts_at)}</span>
                    <span className="inline-flex items-center gap-1"><IconClock size={12} /> Fin : {formatDate(m.ends_at)}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 sm:shrink-0">
                  {m.status === 'scheduled' && (
                    <Button variant="warning" size="sm" onClick={() => cancelMut.mutate(m.id)} disabled={cancelMut.isPending}>
                      Annuler
                    </Button>
                  )}
                  <Button variant="danger" size="sm" onClick={() => { if (confirm('Supprimer ?')) deleteMut.mutate(m.id) }}>
                    Supprimer
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Planifier une maintenance">
        <MaintenanceForm onSuccess={() => { setShowCreate(false); qc.invalidateQueries({ queryKey: ['maintenance'] }) }} />
      </Modal>
    </PageShell>
  )
}
