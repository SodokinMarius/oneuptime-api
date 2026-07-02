import { useParams, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { monitorsApi } from '@/api/monitors'
import { StatusDot } from '@/components/ui/StatusDot'
import { Badge } from '@/components/ui/Badge'
import { TeamBadge } from '@/components/ui/TeamBadge'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { formatDate, formatRelative, formatMs, formatUptime } from '@/utils/format'
import MonitorForm from './MonitorForm'
import { useState } from 'react'
import { DetailPageLayout } from '@/components/layout/DetailPageLayout'
import { DetailSectionMenu } from '@/components/layout/DetailSectionMenu'
import { IconActivity, IconFileText } from '@/components/ui/Icons'

export default function MonitorDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const view = searchParams.get('view') || 'overview'
  const qc = useQueryClient()
  const [showEdit, setShowEdit] = useState(false)
  const basePath = `/monitors/${id}`

  const { data: monitor, isLoading } = useQuery({
    queryKey: ['monitor', id],
    queryFn: () => monitorsApi.get(id!).then(r => r.data),
    enabled: !!id,
  })

  const { data: uptime } = useQuery({
    queryKey: ['monitor-uptime', id],
    queryFn: () => monitorsApi.uptime(id!, 30).then(r => r.data),
    enabled: !!id && view === 'overview',
  })

  const { data: logs } = useQuery({
    queryKey: ['monitor-logs', id],
    queryFn: () => monitorsApi.logs(id!, { page_size: '50' }).then(r => r.data),
    enabled: !!id && view === 'logs',
  })

  const pauseMut = useMutation({
    mutationFn: () => monitor?.is_paused ? monitorsApi.resume(id!) : monitorsApi.pause(id!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['monitor', id] }),
  })

  const deleteMut = useMutation({
    mutationFn: () => monitorsApi.delete(id!),
    onSuccess: () => { window.location.href = '/monitors' },
  })

  if (isLoading) return <Spinner label="Loading…" />
  if (!monitor) return null

  return (
    <>
      <DetailPageLayout
        embedded
        breadcrumbs={[
          { label: 'Monitors', to: '/monitors' },
          { label: monitor.name },
        ]}
        title={
          <span className="flex flex-wrap items-center gap-2">
            <StatusDot status={monitor.status} />
            {monitor.name}
          </span>
        }
        badges={
          <>
            {monitor.is_paused && <Badge label="paused" />}
            <Badge label={monitor.status} />
            <TeamBadge teamId={monitor.team_id} teamName={monitor.team_name} />
          </>
        }
        actions={
          <>
            <Button variant="secondary" onClick={() => setShowEdit(true)}>Edit</Button>
            <Button variant="secondary" onClick={() => pauseMut.mutate()} disabled={pauseMut.isPending}>
              {monitor.is_paused ? 'Resume' : 'Pause'}
            </Button>
            <Button variant="danger" onClick={() => { if (confirm('Delete this monitor?')) deleteMut.mutate() }}>
              Delete
            </Button>
          </>
        }
        sideMenu={
          <DetailSectionMenu
            basePath={basePath}
            defaultView="overview"
            sections={[
              {
                title: 'Monitor',
                items: [
                  { id: 'overview', label: 'Overview', icon: <IconActivity /> },
                  { id: 'logs', label: 'Monitoring logs', icon: <IconFileText /> },
                ],
              },
            ]}
          />
        }
      >
        {view === 'logs' ? (
          <div className="card p-4 sm:p-6">
            <h3 className="section-title mb-4">Monitoring Logs</h3>
            {!logs?.results?.length ? (
              <p className="text-sm text-gray-400 text-center py-8">No checks yet.</p>
            ) : (
              <div className="space-y-2 max-h-[32rem] overflow-y-auto pr-1">
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
        ) : (
          <>
            {uptime && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
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
          </>
        )}
      </DetailPageLayout>

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
    </>
  )
}
