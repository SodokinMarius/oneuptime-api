import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { rbacApi, type ApiKey } from '@/api/rbac'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'
import { IconLock } from '@/components/ui/Icons'
import { formatDate } from '@/utils/format'

function ApiKeyForm({ onSuccess }: { onSuccess: (key: string) => void }) {
  const [form, setForm] = useState({ name: '', permissions: ['*'], expires_at: '' })
  const [error, setError] = useState('')

  const mut = useMutation({
    mutationFn: () => rbacApi.apiKeys.create({
      name: form.name,
      permissions: form.permissions,
      ...(form.expires_at ? { expires_at: new Date(form.expires_at).toISOString() } : {}),
    }),
    onSuccess: (res) => onSuccess(res.data.key ?? ''),
    onError: (err: any) => {
      const d = err.response?.data
      setError(d?.detail || d?.errors?.[0]?.message || JSON.stringify(d))
    },
  })

  return (
    <form onSubmit={e => { e.preventDefault(); setError(''); mut.mutate() }} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
        <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="CI/CD Pipeline, Terraform..." />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Permissions</label>
        <div className="flex gap-2">
          {['*', 'monitor:read', 'monitor:create', 'incident:read'].map(p => (
            <button key={p} type="button" onClick={() => setForm(f => ({
              ...f,
              permissions: f.permissions.includes(p) ? f.permissions.filter(x => x !== p) : [...f.permissions, p]
            }))}
              className={`text-xs px-3 py-1 rounded-full border transition-colors ${form.permissions.includes(p) ? 'bg-blue-100 text-blue-700 border-blue-300' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              {p}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Expiration (optionnel)</label>
        <input type="datetime-local" value={form.expires_at} onChange={e => setForm({ ...form, expires_at: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>}
      <div className="flex justify-end">
        <button type="submit" disabled={mut.isPending}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors">
          {mut.isPending ? 'Génération...' : 'Générer la clé'}
        </button>
      </div>
    </form>
  )
}

export default function ApiKeysTab() {
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [newKey, setNewKey] = useState<string | null>(null)

  const { data: keys, isLoading } = useQuery({
    queryKey: ['api-keys'],
    queryFn: () => rbacApi.apiKeys.list().then(r => r.data),
  })

  const revokeMut = useMutation({
    mutationFn: (id: string) => rbacApi.apiKeys.revoke(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['api-keys'] }),
  })

  if (isLoading) return <div className="flex justify-center py-12"><div className="w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-gray-500">{(keys as ApiKey[])?.length ?? 0} clé(s) active(s)</p>
        <button onClick={() => setShowCreate(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          + Générer une clé
        </button>
      </div>

      {!(keys as ApiKey[])?.length ? (
        <EmptyState icon={<IconLock size={24} />} title="Aucune clé API" description="Générez des clés pour accéder à l'API depuis vos scripts." />
      ) : (
        <div className="space-y-3">
          {(keys as ApiKey[]).map(k => (
            <div key={k.id} className="bg-white border border-gray-200 rounded-xl p-5 flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-gray-900">{k.name}</span>
                  <code className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-mono">{k.key_prefix}...</code>
                </div>
                <div className="flex flex-wrap gap-1 mb-2">
                  {k.permissions.map(p => (
                    <span key={p} className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full font-mono">{p}</span>
                  ))}
                </div>
                <div className="text-xs text-gray-400 space-x-4">
                  <span>Créée le {formatDate(k.created_at)}</span>
                  {k.last_used_at && <span>Dernière utilisation : {formatDate(k.last_used_at)}</span>}
                  {k.expires_at && <span>Expire : {formatDate(k.expires_at)}</span>}
                </div>
              </div>
              <button onClick={() => { if (confirm('Révoquer cette clé ?')) revokeMut.mutate(k.id) }}
                className="text-xs border border-red-200 text-red-500 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors shrink-0">
                Révoquer
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Create modal */}
      <Modal open={showCreate && !newKey} onClose={() => setShowCreate(false)} title="Nouvelle clé API" size="md">
        <ApiKeyForm onSuccess={(key) => {
          setNewKey(key)
          qc.invalidateQueries({ queryKey: ['api-keys'] })
        }} />
      </Modal>

      {/* Show key once modal */}
      <Modal open={!!newKey} onClose={() => { setNewKey(null); setShowCreate(false) }} title="⚠️ Copiez votre clé maintenant" size="md">
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
            Cette clé ne sera affichée <strong>qu'une seule fois</strong>. Copiez-la et stockez-la en sécurité.
          </div>
          <div className="bg-gray-900 rounded-lg p-4">
            <code className="text-emerald-400 text-sm break-all font-mono">{newKey}</code>
          </div>
          <button onClick={() => { navigator.clipboard.writeText(newKey ?? ''); }}
            className="w-full border border-gray-200 text-sm py-2 rounded-lg hover:bg-gray-50 transition-colors">
            📋 Copier dans le presse-papiers
          </button>
          <button onClick={() => { setNewKey(null); setShowCreate(false) }}
            className="w-full bg-blue-600 text-white text-sm py-2 rounded-lg hover:bg-blue-700 transition-colors">
            J'ai copié ma clé, fermer
          </button>
        </div>
      </Modal>
    </div>
  )
}
