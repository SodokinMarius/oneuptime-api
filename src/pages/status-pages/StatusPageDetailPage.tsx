import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { statusPagesApi, unwrapList } from '@/api/statusPages'
import { monitorsApi } from '@/api/monitors'
import { Modal } from '@/components/ui/Modal'
import { TeamBadge } from '@/components/ui/TeamBadge'
import { PageShell } from '@/components/ui/PageShell'
import { Spinner } from '@/components/ui/Spinner'
import { Tabs } from '@/components/ui/Tabs'
import { IconChevronLeft } from '@/components/ui/Icons'
import { formatDate } from '@/utils/format'

type Tab = 'resources' | 'announcements' | 'subscribers' | 'branding'

export default function StatusPageDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [activeTab, setActiveTab] = useState<Tab>('resources')
  const [showAddResource, setShowAddResource] = useState(false)
  const [showAddAnnouncement, setShowAddAnnouncement] = useState(false)

  const { data: page, isLoading } = useQuery({
    queryKey: ['status-page', id],
    queryFn: () => statusPagesApi.get(id!).then(r => r.data),
    enabled: !!id,
  })

  const { data: resourcesRaw } = useQuery({
    queryKey: ['status-page-resources', id],
    queryFn: () => statusPagesApi.resources.list(id!).then(r => r.data),
    enabled: !!id && activeTab === 'resources',
  })
  const resources = resourcesRaw ? unwrapList(resourcesRaw) : undefined

  const { data: announcementsRaw } = useQuery({
    queryKey: ['status-page-announcements', id],
    queryFn: () => statusPagesApi.announcements.list(id!).then(r => r.data),
    enabled: !!id && activeTab === 'announcements',
  })
  const announcements = announcementsRaw ? unwrapList(announcementsRaw) : undefined

  const { data: subscribersRaw } = useQuery({
    queryKey: ['status-page-subscribers', id],
    queryFn: () => statusPagesApi.subscribers.list(id!).then(r => r.data),
    enabled: !!id && activeTab === 'subscribers',
  })
  const subscribers = subscribersRaw ? unwrapList(subscribersRaw) : undefined

  const { data: monitorsData } = useQuery({
    queryKey: ['monitors-list'],
    queryFn: () => monitorsApi.list({ page_size: '100' }).then(r => r.data),
    enabled: showAddResource,
  })

  const removeResourceMutation = useMutation({
    mutationFn: (rid: string) => statusPagesApi.resources.remove(id!, rid),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['status-page-resources', id] }),
  })

  const removeSubscriberMutation = useMutation({
    mutationFn: (sid: string) => statusPagesApi.subscribers.remove(id!, sid),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['status-page-subscribers', id] }),
  })

  const tabs: { id: Tab; label: string }[] = [
    { id: 'resources', label: 'Ressources' },
    { id: 'announcements', label: 'Annonces' },
    { id: 'subscribers', label: 'Abonnés' },
    { id: 'branding', label: 'Branding' },
  ]

  if (isLoading) return <Spinner label="Chargement…" />
  if (!page) return null

  return (
    <PageShell size="narrow">
      <button onClick={() => navigate(-1)} className="back-link">
        <IconChevronLeft size={16} />
        Retour aux status pages
      </button>

      <div className="detail-header">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h2 className="page-header">{page.name}</h2>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${page.is_public ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
              {page.is_public ? 'Public' : 'Privé'}
            </span>
            <TeamBadge teamId={page.team_id} teamName={page.team_name} />
          </div>
          <p className="text-sm text-gray-500">
            Slug : <span className="font-mono">{page.slug}</span>
            {page.custom_domain && <span className="ml-0 sm:ml-3 block sm:inline mt-1 sm:mt-0">Domaine : <span className="font-mono">{page.custom_domain}</span></span>}
          </p>
        </div>
        <a href={`/status/${page.slug}`} target="_blank" rel="noopener noreferrer" className="btn-secondary btn-sm shrink-0">
          Voir la page ↗
        </a>
      </div>

      <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} />

      {/* Resources tab */}
      {activeTab === 'resources' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-500">Monitors affichés sur la page de statut</p>
            <button onClick={() => setShowAddResource(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors">
              + Ajouter
            </button>
          </div>
          {!resources || resources.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">Aucune ressource ajoutée.</div>
          ) : (
            <div className="space-y-2">
              {resources.map(r => (
                <div key={r.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-gray-400 text-sm">#{r.order}</span>
                    <div>
                      <p className="text-sm font-medium text-gray-800">{r.display_name || r.monitor_name || r.group_name}</p>
                      <p className="text-xs text-gray-400">{r.monitor ? 'Monitor' : 'Groupe'}</p>
                    </div>
                    {r.monitor_status && (
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        r.monitor_status === 'operational' ? 'bg-emerald-100 text-emerald-700' :
                        r.monitor_status === 'offline' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                      }`}>{r.monitor_status}</span>
                    )}
                  </div>
                  <button onClick={() => removeResourceMutation.mutate(r.id)}
                    className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50 transition-colors">
                    Retirer
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Announcements tab */}
      {activeTab === 'announcements' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-500">Messages affichés sur la page publique</p>
            <button onClick={() => setShowAddAnnouncement(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors">
              + Nouvelle annonce
            </button>
          </div>
          {!announcements || announcements.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">Aucune annonce.</div>
          ) : (
            <div className="space-y-3">
              {announcements.map(a => (
                <div key={a.id} className="bg-white rounded-xl border border-gray-200 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-sm font-semibold text-gray-800">{a.title}</h4>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${a.is_active ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-400'}`}>
                          {a.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">{a.content}</p>
                    </div>
                    <span className="text-xs text-gray-400 shrink-0">{formatDate(a.created_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Subscribers tab */}
      {activeTab === 'subscribers' && (
        <div>
          <p className="text-sm text-gray-500 mb-4">
            {subscribers?.length ?? 0} abonné(s) vérifié(s)
          </p>
          {!subscribers || subscribers.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">Aucun abonné.</div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Email</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Vérifié</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Inscrit le</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {subscribers.map(s => (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3 text-gray-700">{s.email}</td>
                      <td className="px-5 py-3">
                        <span className={`text-xs font-medium ${s.is_verified ? 'text-emerald-600' : 'text-yellow-600'}`}>
                          {s.is_verified ? '✓ Oui' : '⏳ En attente'}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-gray-500">{formatDate(s.subscribed_at)}</td>
                      <td className="px-5 py-3 text-right">
                        <button onClick={() => removeSubscriberMutation.mutate(s.id)}
                          className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50 transition-colors">
                          Supprimer
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Branding tab */}
      {activeTab === 'branding' && (
        <BrandingForm pageId={id!} page={page} />
      )}

      {/* Add Resource Modal */}
      <Modal open={showAddResource} onClose={() => setShowAddResource(false)} title="Ajouter un monitor">
        <AddResourceForm pageId={id!} monitors={monitorsData?.results ?? []} onClose={() => setShowAddResource(false)} />
      </Modal>

      {/* Add Announcement Modal */}
      <Modal open={showAddAnnouncement} onClose={() => setShowAddAnnouncement(false)} title="Nouvelle annonce">
        <AddAnnouncementForm pageId={id!} onClose={() => setShowAddAnnouncement(false)} />
      </Modal>
    </PageShell>
  )
}

function AddResourceForm({ pageId, monitors, onClose }: { pageId: string; monitors: any[]; onClose: () => void }) {
  const qc = useQueryClient()
  const [monitorId, setMonitorId] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: () => statusPagesApi.resources.add(pageId, { monitor_id: monitorId, display_name: displayName || undefined }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['status-page-resources', pageId] }); onClose() },
    onError: (err: any) => setError(err.response?.data?.errors?.[0]?.message || 'Erreur.'),
  })

  return (
    <div className="space-y-4">
      <div>
        <label className="label">Monitor</label>
        <select value={monitorId} onChange={e => setMonitorId(e.target.value)}
          className="input-field">
          <option value="">Sélectionner...</option>
          {monitors.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </div>
      <div>
        <label className="label">
          Nom d'affichage <span className="text-gray-400 font-normal">(optionnel)</span>
        </label>
        <input value={displayName} onChange={e => setDisplayName(e.target.value)}
          className="input-field"
          placeholder="Utilise le nom du monitor par défaut" />
      </div>
      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
      <div className="flex justify-end gap-2 pt-2">
        <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Annuler</button>
        <button onClick={() => mutation.mutate()} disabled={mutation.isPending || !monitorId}
          className="px-4 py-2 btn-primary disabled:opacity-50">
          {mutation.isPending ? 'Ajout...' : 'Ajouter'}
        </button>
      </div>
    </div>
  )
}

function AddAnnouncementForm({ pageId, onClose }: { pageId: string; onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ title: '', message: '', is_active: true })
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: () => statusPagesApi.announcements.create(pageId, form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['status-page-announcements', pageId] }); onClose() },
    onError: (err: any) => setError(err.response?.data?.errors?.[0]?.message || 'Erreur.'),
  })

  return (
    <div className="space-y-4">
      <div>
        <label className="label">Titre</label>
        <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          className="input-field"
          placeholder="Maintenance planifiée..." />
      </div>
      <div>
        <label className="label">Message</label>
        <textarea value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} rows={4}
          className="input-field resize-none"
          placeholder="Détails de l'annonce..." />
      </div>
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
          className="rounded border-gray-300 text-blue-600" />
        <span className="text-sm text-gray-700">Afficher immédiatement</span>
      </label>
      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
      <div className="flex justify-end gap-2 pt-2">
        <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Annuler</button>
        <button onClick={() => mutation.mutate()} disabled={mutation.isPending || !form.title || !form.message}
          className="px-4 py-2 btn-primary disabled:opacity-50">
          {mutation.isPending ? 'Publication...' : 'Publier'}
        </button>
      </div>
    </div>
  )
}

function BrandingForm({ pageId, page }: { pageId: string; page: any }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    primary_color: page.primary_color ?? '#3B82F6',
    logo_url: page.logo_url ?? '',
    custom_css: page.custom_css ?? '',
  })
  const [domainForm, setDomainForm] = useState({ custom_domain: page.custom_domain ?? '' })
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const brandingMutation = useMutation({
    mutationFn: () => statusPagesApi.branding(pageId, form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['status-page', pageId] })
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    },
    onError: (err: any) => setError(err.response?.data?.errors?.[0]?.message || 'Erreur.'),
  })

  const domainMutation = useMutation({
    mutationFn: () => statusPagesApi.domain(pageId, domainForm),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['status-page', pageId] }),
  })

  return (
    <div className="space-y-8">
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h4 className="text-sm font-semibold text-gray-900">Apparence</h4>
        <div>
          <label className="label">Couleur principale</label>
          <div className="flex items-center gap-3">
            <input type="color" value={form.primary_color} onChange={e => setForm(f => ({ ...f, primary_color: e.target.value }))}
              className="w-10 h-10 rounded-lg border border-gray-300 cursor-pointer p-0.5" />
            <input value={form.primary_color} onChange={e => setForm(f => ({ ...f, primary_color: e.target.value }))}
              className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        <div>
          <label className="label">URL du logo</label>
          <input value={form.logo_url} onChange={e => setForm(f => ({ ...f, logo_url: e.target.value }))}
            className="input-field"
            placeholder="https://exemple.com/logo.png" />
        </div>
        <div>
          <label className="label">CSS personnalisé</label>
          <textarea value={form.custom_css} onChange={e => setForm(f => ({ ...f, custom_css: e.target.value }))} rows={6}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            placeholder="/* CSS personnalisé */" />
        </div>
        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
        {success && <p className="text-sm text-emerald-600 bg-emerald-50 rounded-lg px-3 py-2">✓ Branding mis à jour</p>}
        <button onClick={() => brandingMutation.mutate()} disabled={brandingMutation.isPending}
          className="btn-primary disabled:opacity-50">
          {brandingMutation.isPending ? 'Enregistrement...' : 'Enregistrer le branding'}
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h4 className="text-sm font-semibold text-gray-900">Domaine personnalisé</h4>
        <div>
          <label className="label">Domaine</label>
          <input value={domainForm.custom_domain} onChange={e => setDomainForm({ custom_domain: e.target.value })}
            className="input-field"
            placeholder="status.mondomaine.com" />
        </div>
        <button onClick={() => domainMutation.mutate()} disabled={domainMutation.isPending}
          className="bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          {domainMutation.isPending ? 'Enregistrement...' : 'Configurer le domaine'}
        </button>
      </div>
    </div>
  )
}
