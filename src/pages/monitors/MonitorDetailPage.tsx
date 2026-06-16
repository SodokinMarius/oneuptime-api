import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { monitorsApi } from '@/api/monitors'
import { StatusDot } from '@/components/ui/StatusDot'
import { Badge } from '@/components/ui/Badge'
import { TeamBadge } from '@/components/ui/TeamBadge'
import { PageShell } from '@/components/ui/PageShell'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { IconChevronLeft } from '@/components/ui/Icons'
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

  if (isLoading) return <Spinner label="Chargement…" />
  if (!monitor) return null

  return (
    <PageShell size="narrow">
      <button onClick={() => navigate('/monitors')} className="back-link">
        <IconChevronLeft size={16} />
        Retour aux monitors
      </button>

      <div className="detail-header">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
            <StatusDot status={monitor.status} />
            <h2 className="page-header truncate">{monitor.name}</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {monitor.is_paused && <Badge label="en pause" />}
            <Badge label={monitor.status} />
            <TeamBadge teamId={monitor.team_id} teamName={monitor.team_name} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <Button variant="secondary" onClick={() => pauseMut.mutate()} disabled={pauseMut.isPending}>
            {monitor.is_paused ? 'Reprendre' : 'Mettre en pause'}
          </Button>
          <Button variant="danger" onClick={() => { if (confirm('Supprimer ce monitor ?')) deleteMut.mutate() }}>
            Supprimer
          </Button>
        </div>
      </div>

      {uptime && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
          {[
            { label: 'Uptime (30j)', value: formatUptime(uptime.uptime_percent), color: 'text-emerald-600' },
            { label: 'Total checks', value: uptime.total_checks ?? 0, color: 'text-gray-900' },
            { label: 'Échecs', value: uptime.failed_checks ?? 0, color: 'text-red-500' },
            { label: 'Succès', value: uptime.successful_checks ?? 0, color: 'text-emerald-600' },
          ].map(s => (
            <div key={s.label} className="card p-4 sm:p-5">
              <p className="text-xs text-gray-500 uppercase tracking-wide">{s.label}</p>
              <p className={`text-xl sm:text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="card p-4 sm:p-6">
          <h3 className="section-title mb-4">Configuration</h3>
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
                <dt className="text-gray-500 shrink-0">{k}</dt>
                <dd className="text-gray-900 text-right truncate">{v}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="lg:col-span-2 card p-4 sm:p-6">
          <h3 className="section-title mb-4">Derniers checks</h3>
          {!logs?.results?.length ? (
            <p className="text-sm text-gray-400 text-center py-8">Aucun check pour le moment.</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {logs.results.map(log => (
                <div key={log.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 py-2 border-b border-gray-50 text-sm">
                  <div className="flex items-center gap-3 min-w-0">
                    <Badge label={log.status} />
                    <span className="text-gray-600 truncate">{formatDate(log.checked_at)}</span>
                  </div>
                  <div className="flex items-center gap-4 text-gray-500 shrink-0">
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
    </PageShell>
  )
}
