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

const TYPE_ICON: Record<MonitorType, React.ReactNode> = {
  api:       <IconServer size={14} className="text-brand-400" />,
  website:   <IconWifi size={14} className="text-blue-400" />,
  tcp:       <IconLink size={14} className="text-violet-400" />,
  heartbeat: <IconHeart size={14} className="text-pink-400" />,
  ping:      <IconActivity size={14} className="text-emerald-400" />,
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
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h2 className="page-header">Monitors</h2>
          <p className="page-subtext">
            {data?.count ?? 0} monitor{(data?.count ?? 0) !== 1 ? 's' : ''} configuré{(data?.count ?? 0) !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="btn-primary w-full sm:w-auto"
        >
          <IconPlus size={16} />
          Nouveau monitor
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative w-full sm:w-72">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
            <IconSearch size={15} />
          </span>
          <input
            type="text"
            placeholder="Rechercher un monitor…"
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
          <option value="">Tous les types</option>
          <option value="api">API</option>
          <option value="website">Website</option>
          <option value="tcp">TCP</option>
          <option value="heartbeat">Heartbeat</option>
          <option value="ping">Ping</option>
        </select>
        <TeamFilter value={teamFilter} onChange={setTeamFilter} />
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-400">Chargement…</p>
          </div>
        </div>
      ) : monitors.length === 0 ? (
        <EmptyState
          icon={<IconMonitor size={24} />}
          title="Aucun monitor"
          description="Créez votre premier monitor pour surveiller vos services en temps réel."
          action={
            <button onClick={() => setShowCreate(true)} className="btn-primary">
              <IconPlus size={16} />
              Créer un monitor
            </button>
          }
        />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  <th className="table-th">Nom</th>
                  <th className="table-th hidden sm:table-cell">Type</th>
                  <th className="table-th hidden md:table-cell">Équipe</th>
                  <th className="table-th">Statut</th>
                  <th className="table-th hidden md:table-cell">Dernier check</th>
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
                            en pause
                          </span>
                        )}
                      </Link>
                    </td>
                    <td className="table-td hidden sm:table-cell">
                      <span className="flex items-center gap-1.5 text-gray-500 capitalize">
                        {TYPE_ICON[m.type]}
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
                          title={m.is_paused ? 'Reprendre' : 'Mettre en pause'}
                        >
                          {m.is_paused
                            ? <><IconPlay size={13} /><span className="hidden sm:inline">Reprendre</span></>
                            : <><IconPause size={13} /><span className="hidden sm:inline">Pause</span></>
                          }
                        </button>
                        <Link
                          to={`/monitors/${m.id}`}
                          className="btn-ghost py-1.5 px-2 text-xs text-brand-600 hover:text-brand-700 hover:bg-brand-50"
                        >
                          <span className="hidden sm:inline">Détails</span>
                          <IconArrowRight size={13} className="sm:hidden" />
                        </Link>
                        <button
                          onClick={() => { if (confirm('Supprimer ce monitor ?')) deleteMut.mutate(m.id) }}
                          className="btn-danger"
                          title="Supprimer"
                        >
                          <IconTrash2 size={13} />
                          <span className="hidden sm:inline">Supprimer</span>
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

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Nouveau monitor" size="lg">
        <MonitorForm onSuccess={() => { setShowCreate(false); qc.invalidateQueries({ queryKey: ['monitors'] }) }} />
      </Modal>
    </div>
  )
}
