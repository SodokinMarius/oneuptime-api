import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { incidentsApi } from '@/api/incidents'
import { Badge } from '@/components/ui/Badge'
import { TeamBadge } from '@/components/ui/TeamBadge'
import { TeamFilter } from '@/components/ui/TeamFilter'
import { withTeamFilter } from '@/utils/teamParams'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'
import { ListPageLayout } from '@/components/layout/ListPageLayout'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { IconCheckCircle, IconPlus } from '@/components/ui/Icons'
import { formatRelative } from '@/utils/format'
import IncidentForm from './IncidentForm'
import type { Incident } from '@/types'

type IncidentView = 'all' | 'active' | 'resolved'

const VIEW_CONFIG: Record<IncidentView, { title: string; subtitle: string; breadcrumb: string; emptyTitle: string; emptyDescription: string }> = {
  all: {
    title: 'Incidents',
    subtitle: 'Here is a list of incidents for this project.',
    breadcrumb: 'All incidents',
    emptyTitle: 'No incidents',
    emptyDescription: 'Everything is operational!',
  },
  active: {
    title: 'Active incidents',
    subtitle: 'Unresolved incidents requiring attention.',
    breadcrumb: 'Active incidents',
    emptyTitle: 'No active incidents',
    emptyDescription: 'All incidents are resolved.',
  },
  resolved: {
    title: 'Resolved incidents',
    subtitle: 'Previously resolved incidents.',
    breadcrumb: 'Resolved',
    emptyTitle: 'No resolved incidents',
    emptyDescription: 'No incidents have been resolved yet.',
  },
}

function filterByView(incidents: Incident[], view: IncidentView): Incident[] {
  if (view === 'active') {
    return incidents.filter(i => !i.is_resolved && i.state_name !== 'resolved')
  }
  if (view === 'resolved') {
    return incidents.filter(i => i.is_resolved || i.state_name === 'resolved')
  }
  return incidents
}

export default function IncidentsPage() {
  const [searchParams] = useSearchParams()
  const view = (searchParams.get('view') || 'all') as IncidentView
  const config = VIEW_CONFIG[view] ?? VIEW_CONFIG.all

  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [stateFilter, setStateFilter] = useState('')
  const [teamFilter, setTeamFilter] = useState('')

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['incidents', stateFilter, teamFilter, view],
    queryFn: () => incidentsApi.list(withTeamFilter({
      ...(stateFilter ? { state: stateFilter } : {}),
      ...(view === 'active' ? { resolved: 'false' } : {}),
      ...(view === 'resolved' ? { resolved: 'true' } : {}),
    }, teamFilter)).then(r => r.data),
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

  const incidents = filterByView(data?.results ?? [], view)

  return (
    <ListPageLayout
      embedded
      breadcrumbs={[
        { label: 'Incidents', to: '/incidents' },
        { label: config.breadcrumb },
      ]}
      title={config.title}
      subtitle={config.subtitle}
      actions={
        <Button variant="accent" onClick={() => setShowCreate(true)} fullWidth>
          <IconPlus size={16} />
          Declare incident
        </Button>
      }
    >
      <div className="filter-bar">
        <select
          value={stateFilter}
          onChange={e => setStateFilter(e.target.value)}
          className="input-field w-full sm:w-auto sm:min-w-[180px]"
        >
          <option value="">All states</option>
          {states?.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
        </select>
        <TeamFilter value={teamFilter} onChange={setTeamFilter} />
      </div>

      {isLoading ? (
        <Spinner label="Loading…" />
      ) : incidents.length === 0 ? (
        <EmptyState
          icon={<IconCheckCircle size={24} />}
          title={config.emptyTitle}
          description={config.emptyDescription}
          action={
            view === 'all' ? undefined : (
              <Button variant="secondary" onClick={() => refetch()}>Refresh</Button>
            )
          }
        />
      ) : (
        <>
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
                        <Button variant="warning" size="sm" onClick={() => ackMut.mutate(inc.id)} disabled={ackMut.isPending}>
                          Acknowledge
                        </Button>
                        <Button variant="success" size="sm" onClick={() => resolveMut.mutate(inc.id)} disabled={resolveMut.isPending}>
                          Resolve
                        </Button>
                      </>
                    )}
                    <Link to={`/incidents/${inc.id}`} className="btn-secondary btn-sm">View →</Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-sm text-gray-500 mt-4">
            {incidents.length} incident{incidents.length !== 1 ? 's' : ''} shown.
          </p>
        </>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Declare incident" size="md">
        <IncidentForm onSuccess={() => { setShowCreate(false); qc.invalidateQueries({ queryKey: ['incidents'] }) }} />
      </Modal>
    </ListPageLayout>
  )
}
