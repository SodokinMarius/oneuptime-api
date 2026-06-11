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
import { IconCheckCircle } from '@/components/ui/Icons'
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
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Incidents</h2>
          <p className="text-sm text-gray-500 mt-0.5">{data?.count ?? 0} incident{(data?.count ?? 0) > 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors w-full sm:w-auto">
          + Déclarer un incident
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <select value={stateFilter} onChange={e => setStateFilter(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Tous les états</option>
          {states?.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
        </select>
        <TeamFilter value={teamFilter} onChange={setTeamFilter} />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : incidents.length === 0 ? (
        <EmptyState icon={<IconCheckCircle size={24} />} title="Aucun incident" description="Tout est opérationnel !" />
      ) : (
        <div className="space-y-3">
          {incidents.map(inc => (
            <div key={inc.id} className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 hover:shadow-sm transition-shadow">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <Badge label={inc.severity_name ?? 'unknown'} />
                    <Badge label={inc.state_name ?? 'unknown'} />
                    <TeamBadge teamId={inc.team_id} teamName={inc.team_name} />
                    <span className="text-xs text-gray-400">{formatRelative(inc.created_at)}</span>
                  </div>
                  <Link to={`/incidents/${inc.id}`} className="text-base font-semibold text-gray-900 hover:text-blue-600 truncate block">
                    {inc.title}
                  </Link>
                  {inc.description && (
                    <p className="text-sm text-gray-500 mt-1 line-clamp-2">{inc.description}</p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 sm:shrink-0">
                  {inc.state_name !== 'resolved' && !inc.is_resolved && (
                    <>
                      <button onClick={() => ackMut.mutate(inc.id)}
                        disabled={ackMut.isPending}
                        className="text-xs border border-yellow-200 text-yellow-700 px-2.5 py-1 rounded-lg hover:bg-yellow-50 transition-colors">
                        Accuser réception
                      </button>
                      <button onClick={() => resolveMut.mutate(inc.id)}
                        disabled={resolveMut.isPending}
                        className="text-xs border border-emerald-200 text-emerald-700 px-2.5 py-1 rounded-lg hover:bg-emerald-50 transition-colors">
                        Résoudre
                      </button>
                    </>
                  )}
                  <Link to={`/incidents/${inc.id}`}
                    className="text-xs border border-blue-200 text-blue-600 px-2.5 py-1 rounded-lg hover:bg-blue-50 transition-colors">
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
    </div>
  )
}
