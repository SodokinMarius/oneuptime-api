import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { incidentsApi } from '@/api/incidents'
import { Badge } from '@/components/ui/Badge'
import { TeamBadge } from '@/components/ui/TeamBadge'
import { TeamFilter } from '@/components/ui/TeamFilter'
import { withTeamFilter } from '@/utils/teamParams'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageShell } from '@/components/ui/PageShell'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { IconCheckCircle, IconPlus } from '@/components/ui/Icons'
import { formatRelative } from '@/utils/format'
import IncidentForm from './IncidentForm'

export default function IncidentsPage() {
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [stateFilter, setStateFilter] = useState('')
  const [teamFilter, setTeamFilter] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['incidents', stateFilter, teamFilter],
    queryFn: () => incidentsApi.list(withTeamFilter(
      stateFilter ? { state: stateFilter } : {},
      teamFilter,
    )).then(r => r.data),
  })

  const { data: states } = useQuery({
    queryKey: ['incident-states'],
    queryFn: () => incidentsApi.states.list().then(r => r.data.results),
  })

  const ackMut = useMutation({
    mutationFn: (id: string) => incidentsApi.acknowledge(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['incidents'] }),
  })

  const resolveMut = useMutation({
    mutationFn: (id: string) => incidentsApi.resolve(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['incidents'] }),
  })

  const incidents = data?.results ?? []

  return (
    <PageShell>
      <PageHeader
        title="Incidents"
        subtitle={`${data?.count ?? 0} incident${(data?.count ?? 0) > 1 ? 's' : ''}`}
        actions={
          <Button variant="accent" onClick={() => setShowCreate(true)} fullWidth>
            <IconPlus size={16} />
            Déclarer un incident
          </Button>
        }
      />

      <div className="filter-bar">
        <select
          value={stateFilter}
          onChange={e => setStateFilter(e.target.value)}
          className="input-field w-full sm:w-auto sm:min-w-[180px]"
        >
          <option value="">Tous les états</option>
          {states?.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
        </select>
        <TeamFilter value={teamFilter} onChange={setTeamFilter} />
      </div>

      {isLoading ? (
        <Spinner label="Chargement…" />
      ) : incidents.length === 0 ? (
        <EmptyState
          icon={<IconCheckCircle size={24} />}
          title="Aucun incident"
          description="Tout est opérationnel !"
        />
      ) : (
        <div className="card-list">
          {incidents.map(inc => (
            <div key={inc.id} className="card-item">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <Badge label={inc.severity_name ?? 'unknown'} />
                    <Badge label={inc.state_name ?? 'unknown'} />
                    <TeamBadge teamId={inc.team_id} teamName={inc.team_name} />
                    <span className="text-xs text-gray-400">{formatRelative(inc.created_at)}</span>
                  </div>
                  <Link
                    to={`/incidents/${inc.id}`}
                    className="text-base font-semibold text-gray-900 hover:text-brand-600 truncate block transition-colors"
                  >
                    {inc.title}
                  </Link>
                  {inc.description && (
                    <p className="text-sm text-gray-500 mt-1 line-clamp-2">{inc.description}</p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 sm:shrink-0">
                  {inc.state_name !== 'resolved' && !inc.is_resolved && (
                    <>
                      <Button
                        variant="warning"
                        size="sm"
                        onClick={() => ackMut.mutate(inc.id)}
                        disabled={ackMut.isPending}
                      >
                        Accuser réception
                      </Button>
                      <Button
                        variant="success"
                        size="sm"
                        onClick={() => resolveMut.mutate(inc.id)}
                        disabled={resolveMut.isPending}
                      >
                        Résoudre
                      </Button>
                    </>
                  )}
                  <Link to={`/incidents/${inc.id}`} className="btn-secondary btn-sm">
                    Voir →
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Déclarer un incident" size="md">
        <IncidentForm onSuccess={() => { setShowCreate(false); qc.invalidateQueries({ queryKey: ['incidents'] }) }} />
      </Modal>
    </PageShell>
  )
}
