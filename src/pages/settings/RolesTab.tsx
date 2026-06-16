import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { rbacApi, type Role } from '@/api/rbac'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'
import { PermissionPicker } from '@/components/ui/PermissionPicker'
import { IconShieldCheck } from '@/components/ui/Icons'
import { formatRelative } from '@/utils/format'

function RoleForm({ onSuccess }: { onSuccess: () => void }) {
  const [form, setForm] = useState({ name: '', description: '', permissions: [] as string[] })
  const [error, setError] = useState('')

  const mut = useMutation({
    mutationFn: () => rbacApi.roles.create(form),
    onSuccess,
    onError: (err: any) => {
      const d = err.response?.data
      setError(d?.errors?.[0]?.message || d?.detail || JSON.stringify(d))
    },
  })

  return (
    <form onSubmit={e => { e.preventDefault(); setError(''); mut.mutate() }} className="space-y-4">
      <div>
        <label className="label">Nom du rôle *</label>
        <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
          className="input-field"
          placeholder="Développeur, Ops, Viewer..." />
      </div>
      <div>
        <label className="label">Description</label>
        <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
          className="input-field" />
      </div>

      <div>
        <label className="label">Permissions</label>
        <PermissionPicker
          value={form.permissions}
          onChange={permissions => setForm(f => ({ ...f, permissions }))}
        />
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>}

      <div className="flex justify-end pt-1">
        <button type="submit" disabled={mut.isPending}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium px-5 py-2 rounded-lg text-sm transition-colors">
          {mut.isPending ? 'Création...' : 'Créer le rôle'}
        </button>
      </div>
    </form>
  )
}

export default function RolesTab() {
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)

  const { data: roles, isLoading } = useQuery({
    queryKey: ['roles'],
    queryFn: () => rbacApi.roles.listAll(),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => rbacApi.roles.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roles'] }),
  })

  if (isLoading) return <div className="flex justify-center py-12"><div className="w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-gray-500">{roles?.length ?? 0} rôle(s)</p>
        <button onClick={() => setShowCreate(true)}
          className="btn-primary">
          + Nouveau rôle
        </button>
      </div>

      {!roles?.length ? (
        <EmptyState icon={<IconShieldCheck size={24} />} title="Aucun rôle" />
      ) : (
        <div className="space-y-2">
          {roles.map((role: Role) => (
            <div key={role.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 cursor-pointer hover:bg-gray-50"
                onClick={() => setExpanded(expanded === role.id ? null : role.id)}>
                <div className="flex items-center gap-3">
                  <span className="font-medium text-gray-900">{role.name}</span>
                  {role.is_system && (
                    <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">système</span>
                  )}
                  <span className="text-xs text-gray-400">{role.permissions.length} permission(s)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">{formatRelative(role.created_at)}</span>
                  {!role.is_system && (
                    <button onClick={e => { e.stopPropagation(); if (confirm('Supprimer ce rôle ?')) deleteMut.mutate(role.id) }}
                      className="text-xs border border-red-200 text-red-500 px-2 py-0.5 rounded hover:bg-red-50">
                      Suppr.
                    </button>
                  )}
                  <span className="text-gray-400 text-sm">{expanded === role.id ? '▲' : '▼'}</span>
                </div>
              </div>

              {expanded === role.id && (
                <div className="px-5 py-4 border-t border-gray-100 bg-gray-50">
                  {role.description && <p className="text-sm text-gray-600 mb-3">{role.description}</p>}
                  <div className="flex flex-wrap gap-1.5">
                    {role.permissions.map(p => (
                      <span key={p} className="text-xs bg-white border border-gray-200 text-gray-700 px-2.5 py-1 rounded-full font-mono">
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Nouveau rôle" size="lg">
        <RoleForm onSuccess={() => { setShowCreate(false); qc.invalidateQueries({ queryKey: ['roles'] }) }} />
      </Modal>
    </div>
  )
}
