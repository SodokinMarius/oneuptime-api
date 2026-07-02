import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { monitorsApi } from '@/api/monitors'
import { StatusDot } from '@/components/ui/StatusDot'
import { Badge } from '@/components/ui/Badge'
import { TeamBadge } from '@/components/ui/TeamBadge'
import { TeamFilter } from '@/components/ui/TeamFilter'
import { withTeamFilter } from '@/utils/teamParams'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatRelative } from '@/utils/format'
import type { Monitor, MonitorType } from '@/types'
import MonitorForm from './MonitorForm'
import { ListPageLayout } from '@/components/layout/ListPageLayout'
import { Spinner } from '@/components/ui/Spinner'
import { Button } from '@/components/ui/Button'
import {
  IconPlus,
  IconSearch,
  IconPlay,
  IconPause,
  IconTrash2,
  IconArrowRight,
  IconActivity,
  IconWifi,
  IconServer,
  IconLink,
  IconHeart,
  IconMonitor,
} from '@/components/ui/Icons'

type MonitorView = 'all' | 'non-operational' | 'disabled'

const VIEW_CONFIG: Record<MonitorView, { title: string; subtitle: string; breadcrumb: string; emptyTitle: string; emptyDescription: string }> = {
  all: {
    title: 'Monitors',
    subtitle: 'Here is a list of monitors for this project.',
    breadcrumb: 'All monitors',
    emptyTitle: 'No monitors found',
    emptyDescription: 'Create your first monitor to watch your services in real time.',
  },
  'non-operational': {
    title: 'Non-operational',
    subtitle: 'Monitors that are offline or degraded.',
    breadcrumb: 'Non-operational',
    emptyTitle: 'No non-operational monitors',
    emptyDescription: 'All monitors are operational right now.',
  },
  disabled: {
    title: 'Disabled',
    subtitle: 'Monitors that are paused or disabled.',
    breadcrumb: 'Disabled',
    emptyTitle: 'No disabled monitors',
    emptyDescription: 'No monitors are currently paused or disabled.',
  },
}

const TYPE_ICON: Partial<Record<MonitorType, React.ReactNode>> = {
  api:           <IconServer size={14} className="text-brand-400" />,
  website:       <IconWifi size={14} className="text-blue-400" />,
  tcp:           <IconLink size={14} className="text-violet-400" />,
  heartbeat:     <IconHeart size={14} className="text-pink-400" />,
  ping:          <IconActivity size={14} className="text-emerald-400" />,
  dns:           <IconWifi size={14} className="text-cyan-400" />,
  udp:           <IconLink size={14} className="text-orange-400" />,
  ssl:           <IconServer size={14} className="text-amber-400" />,
  multi_step_api:<IconServer size={14} className="text-indigo-400" />,
  journey:       <IconActivity size={14} className="text-purple-400" />,
}

function filterByView(monitors: Monitor[], view: MonitorView): Monitor[] {
  if (view === 'non-operational') {
    return monitors.filter(m => m.status === 'offline' || m.status === 'degraded')
  }
  if (view === 'disabled') {
    return monitors.filter(m => m.is_paused || m.status === 'disabled')
  }
  return monitors
}

export default function MonitorsPage() {
  const [searchParams] = useSearchParams()
  const view = (searchParams.get('view') || 'all') as MonitorView
  const config = VIEW_CONFIG[view] ?? VIEW_CONFIG.all

  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [teamFilter, setTeamFilter] = useState('')
  const [showCreate, setShowCreate] = useState(false)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['monitors', search, typeFilter, teamFilter, view],
    queryFn: () => monitorsApi.list(withTeamFilter({
      ...(search ? { search } : {}),
      ...(typeFilter ? { type: typeFilter } : {}),
      ...(view === 'disabled' ? { paused: 'true' } : {}),
    }, teamFilter)).then(r => r.data),
  })

  const pauseMut = useMutation({
    mutationFn: ({ id, paused }: { id: string; paused: boolean }) =>
      paused ? monitorsApi.resume(id) : monitorsApi.pause(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['monitors'] }),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => monitorsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['monitors'] }),
  })

  const monitors = filterByView(data?.results ?? [], view)
  const totalCount = monitors.length

  return (
    <ListPageLayout
      embedded
      breadcrumbs={[
        { label: 'Monitors', to: '/monitors' },
        { label: config.breadcrumb },
      ]}
      title={config.title}
      subtitle={config.subtitle}
      actions={
        <Button onClick={() => setShowCreate(true)} fullWidth>
          <IconPlus size={16} />
          Create monitor
        </Button>
      }
    >
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative w-full sm:w-72">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
            <IconSearch size={15} />
          </span>
          <input
            type="text"
            placeholder="Search…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input-field pl-9"
          />
        </div>
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          className="input-field w-full sm:w-auto sm:min-w-[160px]"
        >
          <option value="">All types</option>
          <option value="website">Website</option>
          <option value="api">API</option>
          <option value="tcp">TCP</option>
          <option value="udp">UDP</option>
          <option value="dns">DNS</option>
          <option value="ssl">SSL</option>
          <option value="ping">Ping</option>
          <option value="multi_step_api">Multi-step API</option>
          <option value="journey">User Journey</option>
          <option value="heartbeat">Heartbeat</option>
        </select>
        <TeamFilter value={teamFilter} onChange={setTeamFilter} />
      </div>

      {isLoading ? (
        <Spinner label="Loading…" />
      ) : monitors.length === 0 ? (
        <EmptyState
          icon={<IconMonitor size={24} />}
          title={config.emptyTitle}
          description={config.emptyDescription}
          action={
            view === 'all' ? (
              <Button onClick={() => setShowCreate(true)}>
                <IconPlus size={16} />
                Create monitor
              </Button>
            ) : (
              <Button variant="secondary" onClick={() => refetch()}>
                Refresh
              </Button>
            )
          }
        />
      ) : (
        <>
          <div className="table-wrap">
            <div className="table-scroll">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/60">
                    <th className="table-th">Name</th>
                    <th className="table-th hidden sm:table-cell">Monitor type</th>
                    <th className="table-th hidden md:table-cell">Team</th>
                    <th className="table-th">Monitor status</th>
                    <th className="table-th hidden md:table-cell">Last check</th>
                    <th className="table-th hidden lg:table-cell">URL</th>
                    <th className="table-th text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {monitors.map(m => (
                    <tr key={m.id} className="hover:bg-gray-50/50 transition-colors group">
                      <td className="table-td">
                        <Link
                          to={`/monitors/${m.id}`}
                          className="flex items-center gap-2.5 font-medium text-gray-900 hover:text-brand-600 transition-colors"
                        >
                          <StatusDot status={m.status} />
                          <span className="truncate max-w-[140px] sm:max-w-none">{m.name}</span>
                          {m.is_paused && (
                            <span className="hidden sm:inline text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded font-normal">
                              paused
                            </span>
                          )}
                        </Link>
                      </td>
                      <td className="table-td hidden sm:table-cell">
                        <span className="flex items-center gap-1.5 text-gray-500 capitalize">
                          {TYPE_ICON[m.type] ?? <IconMonitor size={14} className="text-gray-400" />}
                          {m.type}
                        </span>
                      </td>
                      <td className="table-td hidden md:table-cell">
                        <TeamBadge teamId={m.team_id} teamName={m.team_name} />
                      </td>
                      <td className="table-td">
                        <Badge label={m.status} />
                      </td>
                      <td className="table-td text-gray-400 hidden md:table-cell">
                        {formatRelative(m.last_check_at)}
                      </td>
                      <td className="table-td text-gray-400 max-w-[200px] truncate hidden lg:table-cell">
                        {m.url || <span className="text-gray-300">—</span>}
                      </td>
                      <td className="table-td">
                        <div className="flex items-center gap-1.5 justify-end">
                          <button
                            onClick={() => pauseMut.mutate({ id: m.id, paused: m.is_paused })}
                            className="btn-ghost py-1.5 px-2 text-xs"
                            title={m.is_paused ? 'Resume' : 'Pause'}
                          >
                            {m.is_paused
                              ? <><IconPlay size={13} /><span className="hidden sm:inline">Resume</span></>
                              : <><IconPause size={13} /><span className="hidden sm:inline">Pause</span></>
                            }
                          </button>
                          <Link
                            to={`/monitors/${m.id}`}
                            className="btn-ghost py-1.5 px-2 text-xs text-brand-600 hover:text-brand-700 hover:bg-brand-50"
                          >
                            <span className="hidden sm:inline">Details</span>
                            <IconArrowRight size={13} className="sm:hidden" />
                          </Link>
                          <button
                            onClick={() => { if (confirm('Delete this monitor?')) deleteMut.mutate(m.id) }}
                            className="btn-danger"
                            title="Delete"
                          >
                            <IconTrash2 size={13} />
                            <span className="hidden sm:inline">Delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <p className="text-sm text-gray-500 mt-4">
            {totalCount} monitor{totalCount !== 1 ? 's' : ''} in total.
          </p>
        </>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New monitor" size="lg">
        <MonitorForm onSuccess={() => { setShowCreate(false); qc.invalidateQueries({ queryKey: ['monitors'] }) }} />
      </Modal>
    </ListPageLayout>
  )
}
