import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { monitorsApi } from '@/api/monitors'
import { StatusDot } from '@/components/ui/StatusDot'
import { Badge } from '@/components/ui/Badge'
import { TeamBadge } from '@/components/ui/TeamBadge'
import { formatDate, formatRelative, formatMs, formatUptime } from '@/utils/format'

export default function MonitorDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: monitor, isLoading } = useQuery({
    queryKey: ['monitor', id],
    queryFn: () => monitorsApi.get(id!).then(r => r.data),
    enabled: !!id,
  })

  const { data: uptime } = useQuery({
    queryKey: ['monitor-uptime', id],
    queryFn: () => monitorsApi.uptime(id!, 30).then(r => r.data),
    enabled: !!id,
  })

  const { data: logs } = useQuery({
    queryKey: ['monitor-logs', id],
    queryFn: () => monitorsApi.logs(id!, { page_size: '20' }).then(r => r.data),
    enabled: !!id,
  })

  const pauseMut = useMutation({
    mutationFn: () => monitor?.is_paused ? monitorsApi.resume(id!) : monitorsApi.pause(id!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['monitor', id] }),
  })

  const deleteMut = useMutation({
    mutationFn: () => monitorsApi.delete(id!),
    onSuccess: () => navigate('/monitors'),
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!monitor) return null

  return (
    <div className="p-8 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/monitors')} className="text-gray-400 hover:text-gray-600 text-sm">← Retour</button>
          <div className="flex items-center gap-3">
            <StatusDot status={monitor.status} />
            <h2 className="text-2xl font-bold text-gray-900">{monitor.name}</h2>
            {monitor.is_paused && <Badge label="en pause" />}
            <Badge label={monitor.status} />
            <TeamBadge teamId={monitor.team_id} teamName={monitor.team_name} />
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => pauseMut.mutate()} disabled={pauseMut.isPending}
            className="border border-gray-200 text-sm px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">
            {monitor.is_paused ? 'Reprendre' : 'Mettre en pause'}
          </button>
          <button onClick={() => { if (confirm('Supprimer ce monitor ?')) deleteMut.mutate() }}
            className="border border-red-200 text-red-600 text-sm px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors">
            Supprimer
          </button>
        </div>
      </div>

      {/* Stats cards */}
      {uptime && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Uptime (30j)', value: formatUptime(uptime.uptime_percent), color: 'text-emerald-600' },
            { label: 'Total checks', value: uptime.total_checks.toString(), color: 'text-gray-900' },
            { label: 'Échecs', value: uptime.failed_checks.toString(), color: 'text-red-500' },
            { label: 'Succès', value: uptime.successful_checks.toString(), color: 'text-emerald-600' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-5">
              <p className="text-xs text-gray-500 uppercase tracking-wide">{s.label}</p>
              <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Config */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Configuration</h3>
          <dl className="space-y-3 text-sm">
            {[
              ['Type', monitor.type],
              ['URL / Cible', monitor.url || '—'],
              ['Méthode', monitor.method || '—'],
              ['Intervalle', `${monitor.interval_seconds}s`],
              ['Timeout', `${monitor.timeout_seconds}s`],
              ['Tentatives', monitor.retries.toString()],
              ['Dernier check', formatRelative(monitor.last_check_at)],
              ['Prochain check', formatRelative(monitor.next_check_at)],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-2">
                <dt className="text-gray-500">{k}</dt>
                <dd className="text-gray-900 text-right truncate max-w-[160px]">{v}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Logs */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Derniers checks</h3>
          {!logs?.results?.length ? (
            <p className="text-sm text-gray-400 text-center py-8">Aucun check pour le moment.</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {logs.results.map(log => (
                <div key={log.id} className="flex items-center justify-between py-2 border-b border-gray-50 text-sm">
                  <div className="flex items-center gap-3">
                    <Badge label={log.status} />
                    <span className="text-gray-600">{formatDate(log.checked_at)}</span>
                  </div>
                  <div className="flex items-center gap-4 text-gray-500">
                    {log.response_status_code && (
                      <span className={log.response_status_code < 400 ? 'text-emerald-600' : 'text-red-500'}>
                        HTTP {log.response_status_code}
                      </span>
                    )}
                    <span>{formatMs(log.response_time_ms)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
