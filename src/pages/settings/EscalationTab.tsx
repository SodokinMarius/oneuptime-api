import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { incidentsApi } from '@/api/incidents'
import { webhooksApi } from '@/api/webhooks'
import { usersApi } from '@/api/users'
import { extractResults } from '@/utils/api'
import type { EscalationPolicy, EscalationAction } from '@/types'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'
import { TeamSelect } from '@/components/ui/TeamSelect'
import { TeamBadge } from '@/components/ui/TeamBadge'
import { IconAlertTriangle } from '@/components/ui/Icons'
import { teamIdPayload } from '@/utils/teamParams'

const ACTIONS: { value: EscalationAction; label: string }[] = [
  { value: 'notify_webhook', label: 'Notify webhook' },
  { value: 'notify_user', label: 'Notify user' },
  { value: 'increase_severity', label: 'Increase severity' },
  { value: 'assign_user', label: 'Assign user' },
]

function PolicyForm({ policy, onSuccess }: { policy?: EscalationPolicy; onSuccess: () => void }) {
  const isEdit = Boolean(policy)
  const [teamId, setTeamId] = useState(policy?.team_id ?? '')
  const [form, setForm] = useState({
    name: policy?.name ?? '',
    description: policy?.description ?? '',
    is_default: policy?.is_default ?? false,
    is_active: policy?.is_active ?? true,
    severity_names: policy?.severity_names?.join(', ') ?? '',
  })
  const [error, setError] = useState('')

  const payload = () => ({
    name: form.name,
    description: form.description,
    is_default: form.is_default,
    is_active: form.is_active,
    severity_names: form.severity_names
      ? form.severity_names.split(',').map(s => s.trim()).filter(Boolean)
      : [],
    ...teamIdPayload(teamId),
  })

  const mut = useMutation({
    mutationFn: () => isEdit && policy
      ? incidentsApi.escalationPolicies.update(policy.id, payload())
      : incidentsApi.escalationPolicies.create(payload()),
    onSuccess,
    onError: (err: any) => {
      const d = err.response?.data
      setError(d?.errors?.[0]?.message || d?.detail || `Error ${isEdit ? 'updating' : 'creating'} policy.`)
    },
  })

  return (
    <form onSubmit={e => { e.preventDefault(); setError(''); mut.mutate() }} className="space-y-4">
      <div>
        <label className="label">Policy name *</label>
        <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
          className="input-field" placeholder="Default escalation" />
      </div>
      <div>
        <label className="label">Description</label>
        <textarea rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
          className="input-field resize-none" />
      </div>
      <div>
        <label className="label">Severity filter <span className="text-gray-400 font-normal">(comma-separated, empty = all)</span></label>
        <input value={form.severity_names} onChange={e => setForm({ ...form, severity_names: e.target.value })}
          className="input-field" placeholder="critical, high" />
      </div>
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={form.is_default} onChange={e => setForm({ ...form, is_default: e.target.checked })}
          className="rounded border-gray-300 text-brand-600" />
        <span className="text-sm text-gray-700">Default policy for matching severities</span>
      </label>
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })}
          className="rounded border-gray-300 text-brand-600" />
        <span className="text-sm text-gray-700">Active</span>
      </label>
      <TeamSelect value={teamId} onChange={setTeamId} />
      {error && <div className="form-error">{error}</div>}
      <div className="form-actions">
        <button type="submit" disabled={mut.isPending} className="btn-primary disabled:opacity-50">
          {mut.isPending ? 'Saving…' : (isEdit ? 'Save changes' : 'Create policy')}
        </button>
      </div>
    </form>
  )
}

function AddStepForm({ policyId, nextOrder, onSuccess }: { policyId: string; nextOrder: number; onSuccess: () => void }) {
  const [form, setForm] = useState({
    order: nextOrder,
    delay_minutes: 15,
    action: 'notify_webhook' as EscalationAction,
    webhook: '',
    user: '',
    target_severity: '',
  })
  const [error, setError] = useState('')

  const { data: webhooks } = useQuery({
    queryKey: ['webhooks-list'],
    queryFn: () => webhooksApi.list({ page_size: '100' }).then(r => r.data.results),
  })

  const { data: usersData } = useQuery({
    queryKey: ['users-list'],
    queryFn: () => usersApi.list().then(r => r.data),
  })

  const { data: severitiesData } = useQuery({
    queryKey: ['incident-severities'],
    queryFn: () => incidentsApi.severities.list().then(r => r.data),
  })

  const users = usersData ? extractResults(usersData) : []
  const severities = severitiesData ? extractResults(severitiesData) : []

  const mut = useMutation({
    mutationFn: () => incidentsApi.escalationPolicies.addStep(policyId, {
      order: form.order,
      delay_minutes: form.delay_minutes,
      action: form.action,
      ...(form.action === 'notify_webhook' && form.webhook ? { webhook: form.webhook } : {}),
      ...(['notify_user', 'assign_user'].includes(form.action) && form.user ? { user: form.user } : {}),
      ...(form.action === 'increase_severity' && form.target_severity ? { target_severity: form.target_severity } : {}),
    }),
    onSuccess,
    onError: (err: any) => {
      const d = err.response?.data
      setError(d?.errors?.[0]?.message || d?.detail || JSON.stringify(d) || 'Error adding step.')
    },
  })

  return (
    <form onSubmit={e => { e.preventDefault(); setError(''); mut.mutate() }} className="space-y-3 bg-gray-50 rounded-lg p-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Order</label>
          <input type="number" min={1} value={form.order} onChange={e => setForm({ ...form, order: +e.target.value })}
            className="input-field" />
        </div>
        <div>
          <label className="label">Delay (minutes)</label>
          <input type="number" min={1} value={form.delay_minutes} onChange={e => setForm({ ...form, delay_minutes: +e.target.value })}
            className="input-field" />
        </div>
      </div>
      <div>
        <label className="label">Action</label>
        <select value={form.action} onChange={e => setForm({ ...form, action: e.target.value as EscalationAction })}
          className="input-field">
          {ACTIONS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
        </select>
      </div>
      {form.action === 'notify_webhook' && (
        <div>
          <label className="label">Webhook</label>
          <select value={form.webhook} onChange={e => setForm({ ...form, webhook: e.target.value })}
            className="input-field">
            <option value="">Select webhook…</option>
            {webhooks?.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>
      )}
      {['notify_user', 'assign_user'].includes(form.action) && (
        <div>
          <label className="label">User</label>
          <select value={form.user} onChange={e => setForm({ ...form, user: e.target.value })}
            className="input-field">
            <option value="">Select user…</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.email}</option>)}
          </select>
        </div>
      )}
      {form.action === 'increase_severity' && (
        <div>
          <label className="label">Target severity</label>
          <select value={form.target_severity} onChange={e => setForm({ ...form, target_severity: e.target.value })}
            className="input-field">
            <option value="">Select severity…</option>
            {severities.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={mut.isPending} className="btn-primary btn-sm disabled:opacity-50">
        {mut.isPending ? 'Adding…' : 'Add step'}
      </button>
    </form>
  )
}

function PolicyCard({ policy }: { policy: EscalationPolicy }) {
  const qc = useQueryClient()
  const [expanded, setExpanded] = useState(false)
  const [showAddStep, setShowAddStep] = useState(false)
  const [showEdit, setShowEdit] = useState(false)

  const { data: steps, refetch } = useQuery({
    queryKey: ['escalation-steps', policy.id],
    queryFn: () => incidentsApi.escalationPolicies.steps(policy.id).then(r => r.data),
    enabled: expanded,
  })

  const deleteMut = useMutation({
    mutationFn: () => incidentsApi.escalationPolicies.delete(policy.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['escalation-policies'] }),
  })

  const removeStepMut = useMutation({
    mutationFn: (stepId: string) => incidentsApi.escalationPolicies.removeStep(policy.id, stepId),
    onSuccess: () => { refetch(); qc.invalidateQueries({ queryKey: ['escalation-policies'] }) },
  })

  const nextOrder = (steps?.length ?? policy.step_count ?? 0) + 1

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3">
        <button className="flex-1 text-left" onClick={() => setExpanded(!expanded)}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-gray-900">{policy.name}</span>
            {policy.is_default && (
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">default</span>
            )}
            {!policy.is_active && (
              <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">inactive</span>
            )}
            <TeamBadge teamId={policy.team_id} teamName={policy.team_name} />
            <span className="text-xs text-gray-400">{policy.step_count} step(s)</span>
          </div>
          {policy.description && <p className="text-sm text-gray-500 mt-0.5">{policy.description}</p>}
        </button>
        <button onClick={() => setShowEdit(true)} className="text-xs text-brand-600 hover:text-brand-700 px-2 py-1">
          Edit
        </button>
        <button
          onClick={() => { if (confirm('Delete this policy?')) deleteMut.mutate() }}
          className="text-xs text-red-500 hover:text-red-700 px-2 py-1"
        >
          Delete
        </button>
      </div>

      <Modal open={showEdit} onClose={() => setShowEdit(false)} title="Edit escalation policy">
        <PolicyForm
          policy={policy}
          onSuccess={() => {
            setShowEdit(false)
            qc.invalidateQueries({ queryKey: ['escalation-policies'] })
          }}
        />
      </Modal>

      {expanded && (
        <div className="border-t border-gray-100 px-5 py-4 space-y-3">
          {policy.severity_names?.length > 0 && (
            <p className="text-xs text-gray-500">
              Severities: {policy.severity_names.join(', ')}
            </p>
          )}
          {steps && steps.length > 0 ? (
            <div className="space-y-2">
              {steps.map(step => (
                <div key={step.id} className="flex items-center justify-between text-sm bg-gray-50 rounded-lg px-3 py-2">
                  <div>
                    <span className="font-medium text-gray-800">Step {step.order}</span>
                    <span className="text-gray-400 mx-2">·</span>
                    <span className="text-gray-600">after {step.delay_minutes} min → {step.action.replace(/_/g, ' ')}</span>
                  </div>
                  <button onClick={() => removeStepMut.mutate(step.id)}
                    className="text-xs text-red-500 hover:text-red-700">Remove</button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">No steps yet.</p>
          )}
          {showAddStep ? (
            <AddStepForm
              policyId={policy.id}
              nextOrder={nextOrder}
              onSuccess={() => { setShowAddStep(false); refetch() }}
            />
          ) : (
            <button onClick={() => setShowAddStep(true)} className="text-sm text-brand-600 hover:text-brand-700 font-medium">
              + Add step
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default function EscalationTab() {
  const [showCreate, setShowCreate] = useState(false)
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['escalation-policies'],
    queryFn: () => incidentsApi.escalationPolicies.list().then(r => r.data),
  })

  const policies = data?.results ?? []

  return (
    <div>
      <p className="text-sm text-gray-500 mb-4">
        Multi-step escalation when incidents are not acknowledged in time.
      </p>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-gray-500">{policies.length} polic{policies.length === 1 ? 'y' : 'ies'}</p>
        <button onClick={() => setShowCreate(true)} className="btn-primary">+ New policy</button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : policies.length === 0 ? (
        <EmptyState icon={<IconAlertTriangle size={24} />} title="No escalation policies" />
      ) : (
        <div className="space-y-2">
          {policies.map(p => <PolicyCard key={p.id} policy={p} />)}
        </div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New escalation policy">
        <PolicyForm onSuccess={() => {
          setShowCreate(false)
          qc.invalidateQueries({ queryKey: ['escalation-policies'] })
        }} />
      </Modal>
    </div>
  )
}
