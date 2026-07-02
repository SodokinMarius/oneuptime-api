import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { monitorsApi } from '@/api/monitors'
import { StatusDot } from '@/components/ui/StatusDot'
import { Badge } from '@/components/ui/Badge'
import { TeamBadge } from '@/components/ui/TeamBadge'
import { Modal } from '@/components/ui/Modal'
import { PageShell } from '@/components/ui/PageShell'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { IconChevronLeft } from '@/components/ui/Icons'
import { formatDate, formatRelative, formatMs, formatUptime } from '@/utils/format'
import MonitorForm from './MonitorForm'
import { useState } from 'react'

export default function MonitorDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [showEdit, setShowEdit] = useState(false)

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

  if (isLoading) return <Spinner label="Loading…" />
  if (!monitor) return null

  return (
    <PageShell size="narrow">
      <button onClick={() => navigate('/monitors')} className="back-link">
        <IconChevronLeft size={16} />
        Back to monitors
      </button>

      <div className="detail-header">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
            <StatusDot status={monitor.status} />
            <h2 className="page-header truncate">{monitor.name}</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {monitor.is_paused && <Badge label="paused" />}
            <Badge label={monitor.status} />
            <TeamBadge teamId={monitor.team_id} teamName={monitor.team_name} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <Button variant="secondary" onClick={() => setShowEdit(true)}>Edit</Button>
          <Button variant="secondary" onClick={() => pauseMut.mutate()} disabled={pauseMut.isPending}>
            {monitor.is_paused ? 'Resume' : 'Pause'}
          </Button>
          <Button variant="danger" onClick={() => { if (confirm('Delete this monitor?')) deleteMut.mutate() }}>
            Delete
          </Button>
        </div>
      </div>

      {uptime && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
          {[
            { label: 'Uptime (30d)', value: formatUptime(uptime.uptime_percent), color: 'text-emerald-600' },
            { label: 'Total checks', value: uptime.total_checks ?? 0, color: 'text-gray-900' },
            { label: 'Failures', value: uptime.failed_checks ?? 0, color: 'text-red-500' },
            { label: 'Successes', value: uptime.successful_checks ?? 0, color: 'text-emerald-600' },
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
              ['URL / Target', monitor.url || '—'],
              ['Method', monitor.method || '—'],
              ['Interval', `${monitor.interval_seconds}s`],
              ['Timeout', `${monitor.timeout_seconds}s`],
              ['Retries', monitor.retries.toString()],
              ['Steps', monitor.steps?.length ? `${monitor.steps.length} step(s)` : '—'],
              ['Last check', formatRelative(monitor.last_check_at)],
              ['Next check', formatRelative(monitor.next_check_at)],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-2">
                <dt className="text-gray-500 shrink-0">{k}</dt>
                <dd className="text-gray-900 text-right truncate">{v}</dd>
              </div>
            ))}
          </dl>
          {monitor.criteria && Object.keys(monitor.criteria).length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Criteria</p>
              <pre className="text-xs text-gray-600 bg-gray-50 rounded-lg p-3 overflow-x-auto">
                {JSON.stringify(monitor.criteria, null, 2)}
              </pre>
            </div>
          )}
          {monitor.steps && monitor.steps.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Steps</p>
              <pre className="text-xs text-gray-600 bg-gray-50 rounded-lg p-3 overflow-x-auto max-h-48">
                {JSON.stringify(monitor.steps, null, 2)}
              </pre>
            </div>
          )}
        </div>

        <div className="lg:col-span-2 card p-4 sm:p-6">
          <h3 className="section-title mb-4">Recent checks</h3>
          {!logs?.results?.length ? (
            <p className="text-sm text-gray-400 text-center py-8">No checks yet.</p>
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

      <Modal open={showEdit} onClose={() => setShowEdit(false)} title="Edit monitor" size="lg">
        <MonitorForm
          monitor={monitor}
          onSuccess={() => {
            setShowEdit(false)
            qc.invalidateQueries({ queryKey: ['monitor', id] })
            qc.invalidateQueries({ queryKey: ['monitors'] })
          }}
        />
      </Modal>
    </PageShell>
  )
}
