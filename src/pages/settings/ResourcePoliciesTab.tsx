import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { rbacApi } from '@/api/rbac'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'
import { IconShieldCheck } from '@/components/ui/Icons'
import { formatDate } from '@/utils/format'

const RESOURCE_TYPES = ['incident', 'monitor', 'role', 'team', 'project', 'webhook', 'api_key']

function PolicyForm({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ role_id: '', resource_type: '', resource_id: '', effect: 'allow' as 'allow' | 'deny' })
  const [error, setError] = useState('')

  const { data: rolesData, isError: rolesError } = useQuery({
    queryKey: ['roles'],
    queryFn: () => rbacApi.roles.listAll(),
  })
  const roles = rolesData ?? []

  const mutation = useMutation({
    mutationFn: () => rbacApi.resourcePolicies.create({
      role: form.role_id,
      resource_type: form.resource_type,
      resource_id: form.resource_id || undefined,
      effect: form.effect,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['resource-policies'] }); onClose() },
    onError: (err: any) => {
      setError(err.response?.data?.errors?.[0]?.message || 'Error creating policy.')
    },
  })

  return (
    <div className="space-y-4">
      <div>
        <label className="label">Role</label>
        <select value={form.role_id} onChange={e => setForm(f => ({ ...f, role_id: e.target.value }))}
          className="input-field">
          <option value="">Select a role...</option>
          {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        {rolesError && (
          <p className="text-xs text-red-600 mt-1">Unable to load roles. Check your permissions.</p>
        )}
        {!rolesError && roles.length === 0 && (
          <p className="text-xs text-amber-600 mt-1">No roles available. Create a role in the Roles tab.</p>
        )}
      </div>
      <div>
        <label className="label">Resource type</label>
        <select value={form.resource_type} onChange={e => setForm(f => ({ ...f, resource_type: e.target.value }))}
          className="input-field">
          <option value="">Select a type...</option>
          {RESOURCE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <div>
        <label className="label">
          Resource ID <span className="text-gray-400 font-normal">(empty = all resources)</span>
        </label>
        <input value={form.resource_id} onChange={e => setForm(f => ({ ...f, resource_id: e.target.value }))}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
          placeholder="Optional UUID" />
      </div>
      <div>
        <label className="label">Effect</label>
        <div className="flex gap-3">
          {(['allow', 'deny'] as const).map(e => (
            <label key={e} className={`flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer transition-colors ${
              form.effect === e ? e === 'allow' ? 'border-emerald-400 bg-emerald-50' : 'border-red-400 bg-red-50' : 'border-gray-200 hover:border-gray-300'
            }`}>
              <input type="radio" name="effect" value={e} checked={form.effect === e} onChange={() => setForm(f => ({ ...f, effect: e }))} className="sr-only" />
              <span className={`w-2 h-2 rounded-full ${form.effect === e ? e === 'allow' ? 'bg-emerald-500' : 'bg-red-500' : 'bg-gray-300'}`} />
              <span className="text-sm font-medium capitalize">{e === 'allow' ? '✅ Allow' : '🚫 Deny'}</span>
            </label>
          ))}
        </div>
      </div>
      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
      <div className="flex justify-end gap-2 pt-2">
        <button onClick={onClose} className="btn-ghost">Cancel</button>
        <button onClick={() => mutation.mutate()} disabled={mutation.isPending || !form.role_id || !form.resource_type}
          className="px-4 py-2 btn-primary disabled:opacity-50">
          {mutation.isPending ? 'Creating...' : 'Create policy'}
        </button>
      </div>
    </div>
  )
}

export default function ResourcePoliciesTab() {
  const [showCreate, setShowCreate] = useState(false)
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['resource-policies'],
    queryFn: () => rbacApi.resourcePolicies.list().then(r => r.data),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => rbacApi.resourcePolicies.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['resource-policies'] }),
  })

  const policies = data?.results ?? []

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-base font-semibold text-gray-900">Resource policies</h3>
          <p className="text-sm text-gray-500 mt-0.5">Allow/deny rules on specific resources</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors">
          + New policy
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : policies.length === 0 ? (
        <EmptyState icon={<IconShieldCheck size={24} />} title="No policies defined"
          description="Resource policies let you fine-tune permissions at the object level." />
      ) : (
        <div className="space-y-2">
          {policies.map(policy => (
            <div key={policy.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${policy.effect === 'allow' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                  {policy.effect === 'allow' ? '✅ Allow' : '🚫 Deny'}
                </span>
                <div>
                  <span className="text-sm font-medium text-gray-800">{policy.role.name}</span>
                  <span className="text-gray-400 mx-2">→</span>
                  <span className="text-sm text-gray-600">{policy.resource_type}</span>
                  {policy.resource_id && (
                    <span className="text-xs text-gray-400 font-mono ml-1">#{policy.resource_id.slice(0, 8)}</span>
                  )}
                  {!policy.resource_id && <span className="text-xs text-gray-400 ml-1">(all)</span>}
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-xs text-gray-400">{formatDate(policy.created_at)}</span>
                <button onClick={() => { if (confirm('Delete this policy?')) deleteMutation.mutate(policy.id) }}
                  className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50 transition-colors">
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New resource policy">
        <PolicyForm onClose={() => setShowCreate(false)} />
      </Modal>
    </div>
  )
}
