import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ssoApi, type SSOConfig, type SSOProvider } from '@/api/sso'
import { rbacApi } from '@/api/rbac'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'
import { IconShieldCheck } from '@/components/ui/Icons'
import { formatDate } from '@/utils/format'

const PROVIDERS: { value: SSOProvider; label: string }[] = [
  { value: 'okta', label: 'Okta' },
  { value: 'azure_ad', label: 'Azure AD' },
  { value: 'google', label: 'Google Workspace' },
  { value: 'custom', label: 'Custom IdP' },
]

const EMPTY_FORM = {
  name: '',
  description: '',
  provider: 'okta' as SSOProvider,
  entity_id: '',
  sso_url: '',
  slo_url: '',
  x509_cert: '',
  jit_enabled: true,
  enforce_sso: false,
  is_enabled: false,
  default_role_id: '',
  default_team_ids: [] as string[],
  scim_auto_provision: true,
  scim_auto_deprovision: true,
  scim_enable_push_groups: false,
  attribute_map: {} as Record<string, string>,
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }}
      className="text-xs text-blue-600 hover:text-blue-800 shrink-0"
    >
      {copied ? 'Copié !' : label}
    </button>
  )
}

function SSOConfigForm({
  initial,
  onSuccess,
  onCancel,
}: {
  initial?: SSOConfig
  onSuccess: (created?: { scim_token?: string }) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState({
    ...EMPTY_FORM,
    ...(initial ? {
      name: initial.name,
      description: initial.description,
      provider: initial.provider,
      entity_id: initial.entity_id,
      sso_url: initial.sso_url,
      slo_url: initial.slo_url || '',
      x509_cert: '',
      jit_enabled: initial.jit_enabled,
      enforce_sso: initial.enforce_sso,
      is_enabled: initial.is_enabled,
      default_role_id: initial.default_role_id || '',
      default_team_ids: initial.default_team_ids || [],
      scim_auto_provision: initial.scim_auto_provision,
      scim_auto_deprovision: initial.scim_auto_deprovision,
      scim_enable_push_groups: initial.scim_enable_push_groups,
      attribute_map: initial.attribute_map || {},
    } : {}),
  })
  const [error, setError] = useState('')

  const { data: roles } = useQuery({
    queryKey: ['roles'],
    queryFn: () => rbacApi.roles.listAll(),
  })

  const { data: teams } = useQuery({
    queryKey: ['teams'],
    queryFn: () => rbacApi.teams.listAll(),
  })

  const { data: presets } = useQuery({
    queryKey: ['sso-presets'],
    queryFn: () => ssoApi.providerPresets().then(r => r.data),
  })

  const mut = useMutation({
    mutationFn: () => {
      const payload = {
        ...form,
        default_role_id: form.default_role_id || undefined,
        ...(form.x509_cert ? { x509_cert: form.x509_cert } : {}),
      }
      if (initial) {
        return ssoApi.update(initial.id, payload)
      }
      if (!form.x509_cert) {
        throw new Error('Le certificat IdP est requis à la création.')
      }
      return ssoApi.create(payload as Parameters<typeof ssoApi.create>[0])
    },
    onSuccess: (res) => onSuccess({ scim_token: res.data.scim_token }),
    onError: (err: any) => {
      const d = err.response?.data
      setError(d?.detail || d?.errors?.[0]?.message || err.message || 'Erreur')
    },
  })

  const applyPreset = (provider: SSOProvider) => {
    const preset = presets?.[provider]
    setForm(f => ({
      ...f,
      provider,
      attribute_map: preset?.attribute_map ?? f.attribute_map,
    }))
  }

  return (
    <form onSubmit={e => { e.preventDefault(); setError(''); mut.mutate() }} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Nom *</label>
          <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
            className="input-field"
            placeholder="Okta Production" />
        </div>
        <div>
          <label className="label">Provider *</label>
          <select value={form.provider} onChange={e => applyPreset(e.target.value as SSOProvider)}
            className="input-field">
            {PROVIDERS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="label">Description</label>
        <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
          className="input-field" />
      </div>

      <div>
        <label className="label">Entity ID IdP (Issuer) *</label>
        <input required value={form.entity_id} onChange={e => setForm({ ...form, entity_id: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="https://idp.example.com/entity" />
      </div>

      <div>
        <label className="label">SSO URL IdP *</label>
        <input required value={form.sso_url} onChange={e => setForm({ ...form, sso_url: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="https://idp.example.com/sso/saml" />
      </div>

      <div>
        <label className="label">SLO URL IdP (optionnel)</label>
        <input value={form.slo_url} onChange={e => setForm({ ...form, slo_url: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      <div>
        <label className="label">
          Certificat X.509 IdP {initial ? '(laisser vide pour conserver)' : '*'}
        </label>
        <textarea
          required={!initial}
          value={form.x509_cert}
          onChange={e => setForm({ ...form, x509_cert: e.target.value })}
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Rôle par défaut (JIT) *</label>
          <select required value={form.default_role_id} onChange={e => setForm({ ...form, default_role_id: e.target.value })}
            className="input-field">
            <option value="">— Sélectionner —</option>
            {roles?.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Équipes par défaut *</label>
          <select
            multiple
            value={form.default_team_ids}
            onChange={e => setForm({
              ...form,
              default_team_ids: Array.from(e.target.selectedOptions, o => o.value),
            })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[80px]"
          >
            {teams?.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <p className="text-xs text-gray-400 mt-1">Ctrl+clic pour sélection multiple</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 text-sm">
        {[
          ['jit_enabled', 'JIT provisioning'],
          ['enforce_sso', 'Forcer SSO (bloquer mot de passe)'],
          ['is_enabled', 'Activer cette config'],
          ['scim_auto_provision', 'SCIM auto-provision'],
          ['scim_auto_deprovision', 'SCIM auto-deprovision'],
          ['scim_enable_push_groups', 'SCIM push groups'],
        ].map(([key, label]) => (
          <label key={key} className="flex items-center gap-2 text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={form[key as keyof typeof form] as boolean}
              onChange={e => setForm({ ...form, [key]: e.target.checked })}
              className="rounded border-gray-300"
            />
            {label}
          </label>
        ))}
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>}

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel}
          className="text-sm text-gray-600 hover:text-gray-800 px-4 py-2">
          Annuler
        </button>
        <button type="submit" disabled={mut.isPending}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg">
          {mut.isPending ? 'Enregistrement…' : initial ? 'Mettre à jour' : 'Créer'}
        </button>
      </div>
    </form>
  )
}

export default function SSOTab() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editConfig, setEditConfig] = useState<SSOConfig | null>(null)
  const [newScimToken, setNewScimToken] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const { data: configs, isLoading } = useQuery({
    queryKey: ['sso-configs'],
    queryFn: () => ssoApi.list().then(r => r.data.results ?? r.data as unknown as SSOConfig[]),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => ssoApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sso-configs'] }),
  })

  const regenMut = useMutation({
    mutationFn: (id: string) => ssoApi.regenerateScimToken(id),
    onSuccess: (res) => setNewScimToken(res.data.scim_token),
  })

  const list = (configs as SSOConfig[]) ?? []

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div>
      <div className="flex justify-between items-start mb-4 gap-4">
        <div>
          <p className="text-sm text-gray-500">{list.length} configuration(s) SSO</p>
          <p className="text-xs text-gray-400 mt-1">
            Guide : voir <code className="bg-gray-100 px-1 rounded">docs/SSO_GUIDE.md</code> dans le backend
          </p>
        </div>
        <button
          onClick={() => { setEditConfig(null); setShowForm(true) }}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg shrink-0"
        >
          + Ajouter SSO
        </button>
      </div>

      {!list.length ? (
        <EmptyState
          icon={<IconShieldCheck size={24} />}
          title="Aucune configuration SSO"
          description="Connectez Okta, Azure AD ou Google Workspace pour l'authentification fédérée."
        />
      ) : (
        <div className="space-y-3">
          {list.map(cfg => (
            <div key={cfg.id} className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-medium text-gray-900">{cfg.name}</span>
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full uppercase">
                      {cfg.provider}
                    </span>
                    {cfg.is_enabled ? (
                      <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full">Actif</span>
                    ) : (
                      <span className="text-xs bg-gray-50 text-gray-500 px-2 py-0.5 rounded-full">Inactif</span>
                    )}
                    {cfg.enforce_sso && (
                      <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">SSO forcé</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400">Créé le {formatDate(cfg.created_at)}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => setExpandedId(expandedId === cfg.id ? null : cfg.id)}
                    className="text-xs border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-50"
                  >
                    {expandedId === cfg.id ? 'Masquer' : 'Métadonnées SP'}
                  </button>
                  <button
                    onClick={() => { setEditConfig(cfg); setShowForm(true) }}
                    className="text-xs border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-50"
                  >
                    Modifier
                  </button>
                  <button
                    onClick={() => { if (confirm('Supprimer cette config SSO ?')) deleteMut.mutate(cfg.id) }}
                    className="text-xs border border-red-200 text-red-500 px-3 py-1.5 rounded-lg hover:bg-red-50"
                  >
                    Supprimer
                  </button>
                </div>
              </div>

              {expandedId === cfg.id && cfg.sp_metadata && (
                <div className="mt-4 pt-4 border-t border-gray-100 space-y-2 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-gray-500">Entity ID SP :</span>
                      <code className="block text-gray-800 break-all mt-0.5">{cfg.sp_metadata.entity_id}</code>
                    </div>
                    <CopyButton text={cfg.sp_metadata.entity_id} label="Copier" />
                  </div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-gray-500">ACS URL :</span>
                      <code className="block text-gray-800 break-all mt-0.5">{cfg.sp_metadata.acs_url}</code>
                    </div>
                    <CopyButton text={cfg.sp_metadata.acs_url} label="Copier" />
                  </div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-gray-500">SCIM Base URL :</span>
                      <code className="block text-gray-800 break-all mt-0.5">
                        {window.location.origin}/scim/v2/
                      </code>
                    </div>
                    <CopyButton text={`${window.location.origin}/scim/v2/`} label="Copier" />
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-gray-500">Token SCIM :</span>
                    <code className="text-gray-600">{cfg.scim_token_prefix || '••••••••'}</code>
                    <button
                      onClick={() => regenMut.mutate(cfg.id)}
                      className="text-xs text-blue-600 hover:text-blue-800"
                    >
                      Régénérer
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal
        open={showForm}
        onClose={() => { setShowForm(false); setEditConfig(null) }}
        title={editConfig ? 'Modifier la configuration SSO' : 'Nouvelle configuration SSO'}
      >
        <SSOConfigForm
          initial={editConfig ?? undefined}
          onSuccess={(created) => {
            qc.invalidateQueries({ queryKey: ['sso-configs'] })
            setShowForm(false)
            setEditConfig(null)
            if (created?.scim_token) setNewScimToken(created.scim_token)
          }}
          onCancel={() => { setShowForm(false); setEditConfig(null) }}
        />
      </Modal>

      <Modal open={!!newScimToken} onClose={() => setNewScimToken(null)} title="Token SCIM — copiez-le maintenant">
        <p className="text-sm text-gray-600 mb-3">
          Ce token ne sera plus affiché en entier. Configurez-le dans votre IdP (Okta/Azure AD → SCIM).
        </p>
        <code className="block bg-gray-100 p-3 rounded-lg text-xs break-all font-mono">{newScimToken}</code>
        <div className="flex justify-end mt-4">
          <CopyButton text={newScimToken || ''} label="Copier le token" />
        </div>
      </Modal>
    </div>
  )
}
