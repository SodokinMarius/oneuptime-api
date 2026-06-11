import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { rbacApi, type Role } from '@/api/rbac'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'
import { IconShieldCheck } from '@/components/ui/Icons'
import { formatRelative } from '@/utils/format'

function RoleForm({ onSuccess }: { onSuccess: () => void }) {
  const [form, setForm] = useState({ name: '', description: '', permissions: [] as string[] })
  const [permInput, setPermInput] = useState('')
  const [error, setError] = useState('')

  const { data: allPerms } = useQuery({
    queryKey: ['permissions'],
    queryFn: () => rbacApi.roles.permissions().then(r => r.data.permissions),
  })

  const mut = useMutation({
    mutationFn: () => rbacApi.roles.create(form),
    onSuccess,
    onError: (err: any) => {
      const d = err.response?.data
      setError(d?.errors?.[0]?.message || d?.detail || JSON.stringify(d))
    },
  })

  const togglePerm = (p: string) =>
    setForm(f => ({
      ...f,
      permissions: f.permissions.includes(p) ? f.permissions.filter(x => x !== p) : [...f.permissions, p],
    }))

  const addCustom = () => {
    if (permInput.trim() && !form.permissions.includes(permInput.trim())) {
      setForm(f => ({ ...f, permissions: [...f.permissions, permInput.trim()] }))
      setPermInput('')
    }
  }

  // Group permissions by resource
  const grouped = (allPerms ?? []).reduce<Record<string, string[]>>((acc, p) => {
    const [res] = p.split(':')
    if (!acc[res]) acc[res] = []
    acc[res].push(p)
    return acc
  }, {})

  return (
    <form onSubmit={e => { e.preventDefault(); setError(''); mut.mutate() }} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Nom du rôle *</label>
        <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Développeur, Ops, Viewer..." />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Permissions</label>

        {/* Quick toggle: all */}
        <button type="button" onClick={() => setForm(f => ({ ...f, permissions: ['*'] }))}
          className={`text-xs px-3 py-1 rounded-full border mb-3 transition-colors ${form.permissions.includes('*') ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
          ✦ Toutes les permissions (*)
        </button>

        {!form.permissions.includes('*') && (
          <div className="max-h-56 overflow-y-auto border border-gray-200 rounded-lg p-3 space-y-3">
            {Object.entries(grouped).map(([res, perms]) => (
              <div key={res}>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-1">{res}</p>
                <div className="flex flex-wrap gap-2">
                  {perms.map(p => (
                    <button key={p} type="button" onClick={() => togglePerm(p)}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${form.permissions.includes(p) ? 'bg-blue-100 text-blue-700 border-blue-300' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Custom permission */}
        <div className="flex gap-2 mt-2">
          <input value={permInput} onChange={e => setPermInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustom() } }}
            className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="permission:action personnalisée" />
          <button type="button" onClick={addCustom} className="text-sm px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50">Ajouter</button>
        </div>

        {form.permissions.length > 0 && !form.permissions.includes('*') && (
          <div className="flex flex-wrap gap-1 mt-2">
            {form.permissions.map(p => (
              <span key={p} className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                {p}
                <button type="button" onClick={() => togglePerm(p)} className="hover:text-red-600 ml-0.5">×</button>
              </span>
            ))}
          </div>
        )}
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
    queryFn: () => rbacApi.roles.list().then(r => r.data.results),
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
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
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
