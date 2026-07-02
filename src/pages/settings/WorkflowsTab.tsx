import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { incidentsApi } from '@/api/incidents'
import type { IncidentWorkflowRule, IncidentWorkflowTrigger } from '@/types'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'
import { IconZap } from '@/components/ui/Icons'
import { formatRelative } from '@/utils/format'

const TRIGGERS: { value: IncidentWorkflowTrigger; label: string }[] = [
  { value: 'incident_created', label: 'Incident created' },
  { value: 'incident_unacknowledged', label: 'Incident unacknowledged' },
  { value: 'incident_resolved', label: 'Incident resolved' },
]

const CONDITIONS_PLACEHOLDER = `{
  "severity_names": ["critical", "high"],
  "delay_minutes": 15,
  "monitor_id": "optional-uuid"
}`

const ACTIONS_PLACEHOLDER = `[
  { "type": "webhook", "webhook_id": "uuid" },
  { "type": "assign", "user_id": "uuid" },
  { "type": "notify_user", "user_id": "uuid" },
  { "type": "increase_severity", "severity_id": "uuid" }
]`

function WorkflowForm({ rule, onSuccess }: { rule?: IncidentWorkflowRule; onSuccess: () => void }) {
  const isEdit = Boolean(rule)
  const [form, setForm] = useState({
    name: rule?.name ?? '',
    trigger: (rule?.trigger ?? 'incident_created') as IncidentWorkflowTrigger,
    is_active: rule?.is_active ?? true,
    conditions_json: JSON.stringify(rule?.conditions ?? {}, null, 2),
    actions_json: JSON.stringify(rule?.actions ?? [], null, 2) || ACTIONS_PLACEHOLDER,
  })
  const [error, setError] = useState('')

  const mut = useMutation({
    mutationFn: () => {
      let conditions: Record<string, unknown> = {}
      let actions: Record<string, unknown>[] = []
      try {
        conditions = JSON.parse(form.conditions_json || '{}')
        actions = JSON.parse(form.actions_json)
        if (!Array.isArray(actions)) throw new Error('Actions must be a JSON array.')
      } catch (e: any) {
        throw new Error(e.message || 'Invalid JSON in conditions or actions.')
      }
      const payload = {
        name: form.name,
        trigger: form.trigger,
        conditions,
        actions,
        is_active: form.is_active,
      }
      return isEdit && rule
        ? incidentsApi.workflows.update(rule.id, payload)
        : incidentsApi.workflows.create(payload)
    },
    onSuccess,
    onError: (err: any) => {
      if (!err.response) {
        setError(err.message || 'Invalid configuration.')
        return
      }
      const d = err.response?.data
      setError(d?.errors?.[0]?.message || d?.detail || JSON.stringify(d) || `Error ${isEdit ? 'updating' : 'creating'} rule.`)
    },
  })

  return (
    <form onSubmit={e => { e.preventDefault(); setError(''); mut.mutate() }} className="space-y-4">
      <div>
        <label className="label">Rule name *</label>
        <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
          className="input-field" placeholder="Notify on critical incidents" />
      </div>
      <div>
        <label className="label">Trigger</label>
        <select value={form.trigger} onChange={e => setForm({ ...form, trigger: e.target.value as IncidentWorkflowTrigger })}
          className="input-field">
          {TRIGGERS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Conditions (JSON)</label>
        <textarea rows={5} value={form.conditions_json} onChange={e => setForm({ ...form, conditions_json: e.target.value })}
          className="input-field font-mono text-xs resize-none" placeholder={CONDITIONS_PLACEHOLDER} />
      </div>
      <div>
        <label className="label">Actions (JSON array) *</label>
        <textarea required rows={6} value={form.actions_json} onChange={e => setForm({ ...form, actions_json: e.target.value })}
          className="input-field font-mono text-xs resize-none" placeholder={ACTIONS_PLACEHOLDER} />
      </div>
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })}
          className="rounded border-gray-300 text-brand-600" />
        <span className="text-sm text-gray-700">Active</span>
      </label>
      {error && <div className="form-error whitespace-pre-line">{error}</div>}
      <div className="form-actions">
        <button type="submit" disabled={mut.isPending} className="btn-primary disabled:opacity-50">
          {mut.isPending ? 'Saving…' : (isEdit ? 'Save changes' : 'Create rule')}
        </button>
      </div>
    </form>
  )
}

export default function WorkflowsTab() {
  const [showCreate, setShowCreate] = useState(false)
  const [editRule, setEditRule] = useState<IncidentWorkflowRule | null>(null)
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['incident-workflows'],
    queryFn: () => incidentsApi.workflows.list().then(r => r.data),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => incidentsApi.workflows.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['incident-workflows'] }),
  })

  const rules = data?.results ?? []

  return (
    <div>
      <p className="text-sm text-gray-500 mb-4">
        Automate incident responses with event-driven rules (webhooks, assignments, notifications).
      </p>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-gray-500">{rules.length} rule{rules.length !== 1 ? 's' : ''}</p>
        <button onClick={() => setShowCreate(true)} className="btn-primary">+ New rule</button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : rules.length === 0 ? (
        <EmptyState icon={<IconZap size={24} />} title="No workflow rules" />
      ) : (
        <div className="space-y-2">
          {rules.map(rule => (
            <div key={rule.id} className="bg-white border border-gray-200 rounded-xl px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="font-medium text-gray-900">{rule.name}</span>
                    {!rule.is_active && (
                      <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">inactive</span>
                    )}
                    <span className="text-xs bg-violet-50 text-violet-700 px-2 py-0.5 rounded font-mono">
                      {rule.trigger}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">{formatRelative(rule.created_at)} · {rule.actions?.length ?? 0} action(s)</p>
                  {Object.keys(rule.conditions || {}).length > 0 && (
                    <pre className="text-xs text-gray-500 bg-gray-50 rounded mt-2 p-2 overflow-x-auto">
                      {JSON.stringify(rule.conditions, null, 2)}
                    </pre>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => setEditRule(rule)}
                    className="text-xs text-brand-600 hover:text-brand-700"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => { if (confirm('Delete this rule?')) deleteMut.mutate(rule.id) }}
                    className="text-xs text-red-500 hover:text-red-700"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New workflow rule" size="lg">
        <WorkflowForm onSuccess={() => {
          setShowCreate(false)
          qc.invalidateQueries({ queryKey: ['incident-workflows'] })
        }} />
      </Modal>

      <Modal open={!!editRule} onClose={() => setEditRule(null)} title="Edit workflow rule" size="lg">
        {editRule && (
          <WorkflowForm
            rule={editRule}
            onSuccess={() => {
              setEditRule(null)
              qc.invalidateQueries({ queryKey: ['incident-workflows'] })
            }}
          />
        )}
      </Modal>
    </div>
  )
}
