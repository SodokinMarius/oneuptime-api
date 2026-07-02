import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { maintenanceApi } from '@/api/maintenance'
import { monitorsApi } from '@/api/monitors'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageShell } from '@/components/ui/PageShell'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { formatDate } from '@/utils/format'
import { fromDatetimeLocalValue, toDatetimeLocalValue } from '@/utils/datetime'
import { IconClock, IconPlus, IconWrench } from '@/components/ui/Icons'
import { TeamBadge } from '@/components/ui/TeamBadge'
import { TeamFilter } from '@/components/ui/TeamFilter'
import { TeamSelect } from '@/components/ui/TeamSelect'
import { teamIdPayload, withTeamFilter } from '@/utils/teamParams'
import type { Maintenance } from '@/types'

const WEEKDAYS = [
  { value: 0, label: 'Mon' },
  { value: 1, label: 'Tue' },
  { value: 2, label: 'Wed' },
  { value: 3, label: 'Thu' },
  { value: 4, label: 'Fri' },
  { value: 5, label: 'Sat' },
  { value: 6, label: 'Sun' },
]

function MaintenanceForm({
  item,
  onSuccess,
}: {
  item?: Maintenance
  onSuccess: () => void
}) {
  const isEdit = Boolean(item)
  const [teamId, setTeamId] = useState(item?.team_id ?? '')
  const [form, setForm] = useState({
    title: item?.title ?? '',
    description: item?.description ?? '',
    starts_at: toDatetimeLocalValue(item?.starts_at),
    ends_at: toDatetimeLocalValue(item?.ends_at),
    monitors: item?.monitors ?? [] as string[],
    is_visible_on_status_page: item?.is_visible_on_status_page ?? true,
    notify_subscribers: item?.notify_subscribers ?? true,
    recurrence_frequency: (item?.recurrence_frequency ?? 'none') as Maintenance['recurrence_frequency'],
    recurrence_interval: item?.recurrence_interval ?? 1,
    recurrence_weekdays: item?.recurrence_weekdays ?? [] as number[],
    recurrence_until: toDatetimeLocalValue(item?.recurrence_until),
  })
  const [error, setError] = useState('')

  const { data: monitorsData } = useQuery({
    queryKey: ['monitors-for-maintenance'],
    queryFn: () => monitorsApi.list({ page_size: '200' }).then(r => r.data.results),
  })

  const toggleWeekday = (day: number) => {
    setForm(f => ({
      ...f,
      recurrence_weekdays: f.recurrence_weekdays.includes(day)
        ? f.recurrence_weekdays.filter(d => d !== day)
        : [...f.recurrence_weekdays, day].sort(),
    }))
  }

  const toggleMonitor = (id: string) => {
    setForm(f => ({
      ...f,
      monitors: f.monitors.includes(id)
        ? f.monitors.filter(m => m !== id)
        : [...f.monitors, id],
    }))
  }

  const buildPayload = () => ({
    title: form.title,
    description: form.description,
    starts_at: fromDatetimeLocalValue(form.starts_at),
    ends_at: fromDatetimeLocalValue(form.ends_at),
    monitors: form.monitors,
    is_visible_on_status_page: form.is_visible_on_status_page,
    notify_subscribers: form.notify_subscribers,
    recurrence_frequency: form.recurrence_frequency,
    recurrence_interval: form.recurrence_interval,
    ...(form.recurrence_frequency === 'weekly' && form.recurrence_weekdays.length
      ? { recurrence_weekdays: form.recurrence_weekdays }
      : {}),
    ...(form.recurrence_until ? { recurrence_until: fromDatetimeLocalValue(form.recurrence_until) } : {}),
    ...teamIdPayload(teamId),
  })

  const mut = useMutation({
    mutationFn: () => {
      const payload = buildPayload()
      return isEdit && item
        ? maintenanceApi.update(item.id, payload)
        : maintenanceApi.create(payload)
    },
    onSuccess,
    onError: (err: any) => {
      const d = err.response?.data
      if (d?.errors?.length) {
        setError(d.errors.map((e: any) => e.field ? `${e.field} : ${e.message}` : e.message).join('\n'))
      } else if (d?.detail) {
        setError(d.detail)
      } else if (typeof d === 'object') {
        setError(Object.entries(d).map(([k, v]) => `${k} : ${Array.isArray(v) ? v.join(', ') : v}`).join('\n'))
      } else {
        setError('An error occurred.')
      }
    },
  })

  return (
    <form onSubmit={e => { e.preventDefault(); setError(''); mut.mutate() }} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
      <div>
        <label className="label">Title *</label>
        <input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
          className="input-field" placeholder="Database upgrade" />
      </div>
      <div>
        <label className="label">Description</label>
        <textarea rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
          className="input-field resize-none" placeholder="Describe the maintenance…" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Start *</label>
          <input required type="datetime-local" value={form.starts_at}
            onChange={e => setForm({ ...form, starts_at: e.target.value })}
            className="input-field" />
        </div>
        <div>
          <label className="label">End *</label>
          <input required type="datetime-local" value={form.ends_at}
            onChange={e => setForm({ ...form, ends_at: e.target.value })}
            className="input-field" />
        </div>
      </div>

      <div>
        <label className="label">
          Affected monitors <span className="text-gray-400 font-normal">(empty = entire project)</span>
        </label>
        <div className="border border-gray-200 rounded-lg p-3 max-h-40 overflow-y-auto space-y-2">
          {(monitorsData ?? []).length === 0 ? (
            <p className="text-sm text-gray-400">No monitors available.</p>
          ) : (
            monitorsData!.map(m => (
              <label key={m.id} className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={form.monitors.includes(m.id)}
                  onChange={() => toggleMonitor(m.id)}
                  className="rounded border-gray-300 text-brand-600"
                />
                <span className="truncate">{m.name}</span>
                <span className="text-xs text-gray-400 capitalize">{m.type}</span>
              </label>
            ))
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={form.is_visible_on_status_page}
            onChange={e => setForm({ ...form, is_visible_on_status_page: e.target.checked })}
            className="rounded border-gray-300 text-brand-600" />
          <span className="text-sm text-gray-700">Show on status page</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={form.notify_subscribers}
            onChange={e => setForm({ ...form, notify_subscribers: e.target.checked })}
            className="rounded border-gray-300 text-brand-600" />
          <span className="text-sm text-gray-700">Notify subscribers (email / SMS)</span>
        </label>
      </div>

      <div className="border-t border-gray-100 pt-4 space-y-4">
        <h4 className="text-sm font-medium text-gray-900">Recurrence</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Frequency</label>
            <select
              value={form.recurrence_frequency}
              onChange={e => setForm({ ...form, recurrence_frequency: e.target.value as typeof form.recurrence_frequency })}
              className="input-field"
              disabled={isEdit && Boolean(item?.series_id)}
            >
              <option value="none">One-time</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
          {form.recurrence_frequency !== 'none' && (
            <>
              <div>
                <label className="label">Repeat every</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={52}
                    value={form.recurrence_interval}
                    onChange={e => setForm({ ...form, recurrence_interval: +e.target.value })}
                    className="input-field w-20"
                  />
                  <span className="text-sm text-gray-500">
                    {form.recurrence_frequency === 'daily' && 'day(s)'}
                    {form.recurrence_frequency === 'weekly' && 'week(s)'}
                    {form.recurrence_frequency === 'monthly' && 'month(s)'}
                  </span>
                </div>
              </div>
              {form.recurrence_frequency === 'weekly' && (
                <div className="sm:col-span-2">
                  <label className="label">On weekdays</label>
                  <div className="flex flex-wrap gap-2">
                    {WEEKDAYS.map(d => (
                      <button
                        key={d.value}
                        type="button"
                        onClick={() => toggleWeekday(d.value)}
                        className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                          form.recurrence_weekdays.includes(d.value)
                            ? 'bg-brand-600 text-white border-brand-600'
                            : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="sm:col-span-2">
                <label className="label">Repeat until <span className="text-gray-400 font-normal">(optional)</span></label>
                <input
                  type="datetime-local"
                  value={form.recurrence_until}
                  onChange={e => setForm({ ...form, recurrence_until: e.target.value })}
                  className="input-field"
                />
              </div>
            </>
          )}
        </div>
      </div>

      <TeamSelect value={teamId} onChange={setTeamId} />
      {error && <div className="form-error whitespace-pre-line">{error}</div>}
      <div className="form-actions">
        <Button type="submit" disabled={mut.isPending}>
          {mut.isPending ? 'Saving…' : (isEdit ? 'Save changes' : 'Schedule')}
        </Button>
      </div>
    </form>
  )
}

export default function MaintenancePage() {
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [editItem, setEditItem] = useState<Maintenance | null>(null)
  const [teamFilter, setTeamFilter] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['maintenance', teamFilter],
    queryFn: () => maintenanceApi.list(withTeamFilter({}, teamFilter)).then(r => r.data),
  })

  const cancelMut = useMutation({
    mutationFn: (id: string) => maintenanceApi.cancel(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['maintenance'] }),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => maintenanceApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['maintenance'] }),
  })

  const items = data?.results ?? []

  const onFormSuccess = () => {
    setShowCreate(false)
    setEditItem(null)
    qc.invalidateQueries({ queryKey: ['maintenance'] })
  }

  return (
    <PageShell>
      <PageHeader
        title="Scheduled maintenance"
        subtitle={`${data?.count ?? 0} window${(data?.count ?? 0) > 1 ? 's' : ''}`}
        actions={
          <Button onClick={() => setShowCreate(true)} fullWidth>
            <IconPlus size={16} />
            Schedule maintenance
          </Button>
        }
      />

      <div className="filter-bar">
        <TeamFilter value={teamFilter} onChange={setTeamFilter} />
      </div>

      {isLoading ? (
        <Spinner label="Loading…" />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<IconWrench size={24} />}
          title="No scheduled maintenance"
          description="Schedule maintenance windows to suppress alerts."
          action={<Button onClick={() => setShowCreate(true)}>Schedule</Button>}
        />
      ) : (
        <div className="card-list">
          {items.map(m => (
            <div key={m.id} className="card-item">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <Badge label={m.status} />
                    <TeamBadge teamId={m.team_id} teamName={m.team_name} />
                  </div>
                  <h3 className="font-semibold text-gray-900">{m.title}</h3>
                  {m.description && <p className="text-sm text-gray-500 mt-1">{m.description}</p>}
                  <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:gap-4 mt-2 text-xs text-gray-400">
                    <span className="inline-flex items-center gap-1"><IconClock size={12} /> Start: {formatDate(m.starts_at)}</span>
                    <span className="inline-flex items-center gap-1"><IconClock size={12} /> End: {formatDate(m.ends_at)}</span>
                    {m.monitors?.length > 0 && (
                      <span>{m.monitors.length} monitor{m.monitors.length > 1 ? 's' : ''}</span>
                    )}
                    {m.recurrence_frequency && m.recurrence_frequency !== 'none' && (
                      <span className="inline-flex items-center gap-1 capitalize">
                        Repeats {m.recurrence_frequency}
                        {m.recurrence_interval > 1 ? ` every ${m.recurrence_interval}` : ''}
                      </span>
                    )}
                    {m.series_id && (
                      <span className="font-mono text-gray-300">Series {m.series_id.slice(0, 8)}…</span>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 sm:shrink-0">
                  {m.status === 'scheduled' && (
                    <>
                      <Button variant="secondary" size="sm" onClick={() => setEditItem(m)}>Edit</Button>
                      <Button variant="warning" size="sm" onClick={() => cancelMut.mutate(m.id)} disabled={cancelMut.isPending}>
                        Cancel
                      </Button>
                    </>
                  )}
                  <Button variant="danger" size="sm" onClick={() => { if (confirm('Delete?')) deleteMut.mutate(m.id) }}>
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Schedule maintenance" size="lg">
        <MaintenanceForm onSuccess={onFormSuccess} />
      </Modal>

      <Modal open={!!editItem} onClose={() => setEditItem(null)} title="Edit maintenance" size="lg">
        {editItem && <MaintenanceForm item={editItem} onSuccess={onFormSuccess} />}
      </Modal>
    </PageShell>
  )
}
