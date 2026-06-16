import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { rbacApi, type ApiKey } from '@/api/rbac'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { PermissionPicker } from '@/components/ui/PermissionPicker'
import { IconLock } from '@/components/ui/Icons'
import { formatDate } from '@/utils/format'

function ApiKeyForm({ onSuccess }: { onSuccess: (key: string) => void }) {
  const [form, setForm] = useState({ name: '', permissions: ['*'] as string[], expires_at: '' })
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
        <label className="label">Nom *</label>
        <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
          className="input-field"
          placeholder="CI/CD Pipeline, Terraform…" />
      </div>
      <div>
        <label className="label">Permissions</label>
        <PermissionPicker
          value={form.permissions}
          onChange={permissions => setForm(f => ({ ...f, permissions }))}
        />
      </div>
      <div>
        <label className="label">Expiration (optionnel)</label>
        <input type="datetime-local" value={form.expires_at} onChange={e => setForm({ ...form, expires_at: e.target.value })}
          className="input-field" />
      </div>
      {error && <div className="form-error">{error}</div>}
      <div className="form-actions">
        <Button type="submit" disabled={mut.isPending || form.permissions.length === 0}>
          {mut.isPending ? 'Génération…' : 'Générer la clé'}
        </Button>
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

  if (isLoading) return <Spinner size="sm" />

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center mb-4">
        <p className="text-sm text-gray-500">{(keys as ApiKey[])?.length ?? 0} clé(s) active(s)</p>
        <Button onClick={() => setShowCreate(true)} className="w-full sm:w-auto">
          Générer une clé
        </Button>
      </div>

      {!(keys as ApiKey[])?.length ? (
        <EmptyState icon={<IconLock size={24} />} title="Aucune clé API" description="Générez des clés pour accéder à l'API depuis vos scripts." />
      ) : (
        <div className="card-list">
          {(keys as ApiKey[]).map(k => (
            <div key={k.id} className="card-item flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="font-medium text-gray-900">{k.name}</span>
                  <code className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-mono">{k.key_prefix}…</code>
                </div>
                <div className="flex flex-wrap gap-1 mb-2">
                  {k.permissions.map(p => (
                    <span key={p} className="text-xs bg-brand-50 text-brand-700 px-2 py-0.5 rounded-full font-mono">{p}</span>
                  ))}
                </div>
                <div className="text-xs text-gray-400 flex flex-col sm:flex-row sm:flex-wrap gap-1 sm:gap-4">
                  <span>Créée le {formatDate(k.created_at)}</span>
                  {k.last_used_at && <span>Dernière utilisation : {formatDate(k.last_used_at)}</span>}
                  {k.expires_at && <span>Expire : {formatDate(k.expires_at)}</span>}
                </div>
              </div>
              <Button variant="danger" size="sm" onClick={() => { if (confirm('Révoquer cette clé ?')) revokeMut.mutate(k.id) }}>
                Révoquer
              </Button>
            </div>
          ))}
        </div>
      )}

      <Modal open={showCreate && !newKey} onClose={() => setShowCreate(false)} title="Nouvelle clé API" size="lg">
        <ApiKeyForm onSuccess={(key) => {
          setNewKey(key)
          qc.invalidateQueries({ queryKey: ['api-keys'] })
        }} />
      </Modal>

      <Modal open={!!newKey} onClose={() => { setNewKey(null); setShowCreate(false) }} title="Copiez votre clé maintenant" size="md">
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
            Cette clé ne sera affichée <strong>qu'une seule fois</strong>. Copiez-la et stockez-la en sécurité.
          </div>
          <div className="bg-gray-900 rounded-lg p-4">
            <code className="text-emerald-400 text-sm break-all font-mono">{newKey}</code>
          </div>
          <Button variant="secondary" fullWidth onClick={() => { navigator.clipboard.writeText(newKey ?? '') }}>
            Copier dans le presse-papiers
          </Button>
          <Button fullWidth onClick={() => { setNewKey(null); setShowCreate(false) }}>
            J'ai copié ma clé, fermer
          </Button>
        </div>
      </Modal>
    </div>
  )
}
