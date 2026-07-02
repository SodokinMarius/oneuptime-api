import { useState } from 'react'
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
import type { MonitorType } from '@/types'
import MonitorForm from './MonitorForm'
import { PageShell } from '@/components/ui/PageShell'
import { PageHeader } from '@/components/ui/PageHeader'
import { Spinner } from '@/components/ui/Spinner'
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

export default function MonitorsPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [teamFilter, setTeamFilter] = useState('')
  const [showCreate, setShowCreate] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['monitors', search, typeFilter, teamFilter],
    queryFn: () => monitorsApi.list(withTeamFilter({
      ...(search ? { search } : {}),
      ...(typeFilter ? { type: typeFilter } : {}),
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

  const monitors = data?.results ?? []

  return (
    <PageShell>
      <PageHeader
        title="Monitors"
        subtitle={`${data?.count ?? 0} monitor${(data?.count ?? 0) !== 1 ? 's' : ''} configured`}
        actions={
          <button onClick={() => setShowCreate(true)} className="btn-primary w-full sm:w-auto">
            <IconPlus size={16} />
            New monitor
          </button>
        }
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative w-full sm:w-72">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
            <IconSearch size={15} />
          </span>
          <input
            type="text"
            placeholder="Search monitors…"
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

      {/* Content */}
      {isLoading ? (
        <Spinner label="Loading…" />
      ) : monitors.length === 0 ? (
        <EmptyState
          icon={<IconMonitor size={24} />}
          title="No monitors"
          description="Create your first monitor to watch your services in real time."
          action={
            <button onClick={() => setShowCreate(true)} className="btn-primary">
              <IconPlus size={16} />
              Create monitor
            </button>
          }
        />
      ) : (
        <div className="table-wrap">
          <div className="table-scroll">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  <th className="table-th">Name</th>
                  <th className="table-th hidden sm:table-cell">Type</th>
                  <th className="table-th hidden md:table-cell">Team</th>
                  <th className="table-th">Status</th>
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
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New monitor" size="lg">
        <MonitorForm onSuccess={() => { setShowCreate(false); qc.invalidateQueries({ queryKey: ['monitors'] }) }} />
      </Modal>
    </PageShell>
  )
}
