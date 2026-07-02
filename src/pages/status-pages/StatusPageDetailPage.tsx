import { useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { statusPagesApi, unwrapList, type StatusPageResource, type Subscriber } from '@/api/statusPages'
import { monitorsApi } from '@/api/monitors'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { TeamBadge } from '@/components/ui/TeamBadge'
import { DetailPageLayout } from '@/components/layout/DetailPageLayout'
import { DetailSectionMenu } from '@/components/layout/DetailSectionMenu'
import { Spinner } from '@/components/ui/Spinner'
import { formatDate } from '@/utils/format'
import type { StatusPage } from '@/types'
import {
  IconGrid,
  IconFileText,
  IconActivity,
  IconFolder,
  IconMail,
  IconBell,
  IconSettings,
} from '@/components/ui/Icons'

type View =
  | 'overview'
  | 'announcements'
  | 'monitors'
  | 'groups'
  | 'subscribers-email'
  | 'subscribers-sms'
  | 'branding'

const RESOURCE_VIEWS = new Set<View>(['monitors', 'groups'])
const SUBSCRIBER_VIEWS = new Set<View>(['subscribers-email', 'subscribers-sms'])

export default function StatusPageDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const activeView = (searchParams.get('view') || 'overview') as View
  const basePath = `/status-pages/${id}`
  const qc = useQueryClient()
  const [showEdit, setShowEdit] = useState(false)
  const [showAddMonitor, setShowAddMonitor] = useState(false)
  const [showAddGroup, setShowAddGroup] = useState(false)
  const [showAddAnnouncement, setShowAddAnnouncement] = useState(false)

  const { data: page, isLoading } = useQuery({
    queryKey: ['status-page', id],
    queryFn: () => statusPagesApi.get(id!).then(r => r.data),
    enabled: !!id,
  })

  const { data: resourcesRaw } = useQuery({
    queryKey: ['status-page-resources', id],
    queryFn: () => statusPagesApi.resources.list(id!).then(r => r.data),
    enabled: !!id && RESOURCE_VIEWS.has(activeView),
  })
  const resources = resourcesRaw ? unwrapList(resourcesRaw) : undefined

  const { data: announcementsRaw } = useQuery({
    queryKey: ['status-page-announcements', id],
    queryFn: () => statusPagesApi.announcements.list(id!).then(r => r.data),
    enabled: !!id && activeView === 'announcements',
  })
  const announcements = announcementsRaw ? unwrapList(announcementsRaw) : undefined

  const { data: subscribersRaw } = useQuery({
    queryKey: ['status-page-subscribers', id],
    queryFn: () => statusPagesApi.subscribers.list(id!).then(r => r.data),
    enabled: !!id && SUBSCRIBER_VIEWS.has(activeView),
  })
  const subscribers = subscribersRaw ? unwrapList(subscribersRaw) : undefined

  const { data: monitorsData } = useQuery({
    queryKey: ['monitors-list'],
    queryFn: () => monitorsApi.list({ page_size: '100' }).then(r => r.data),
    enabled: showAddMonitor,
  })

  const { data: groupsData } = useQuery({
    queryKey: ['monitor-groups-list'],
    queryFn: () => monitorsApi.groups.list({ page_size: '100' }).then(r => r.data),
    enabled: showAddGroup,
  })

  const removeResourceMutation = useMutation({
    mutationFn: (rid: string) => statusPagesApi.resources.remove(id!, rid),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['status-page-resources', id] }),
  })

  const removeSubscriberMutation = useMutation({
    mutationFn: (sid: string) => statusPagesApi.subscribers.remove(id!, sid),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['status-page-subscribers', id] }),
  })

  if (isLoading) return <Spinner label="Loading…" />
  if (!page) return null

  const monitorResources = (resources ?? []).filter(r => r.monitor)
  const groupResources = (resources ?? []).filter(r => r.monitor_group)
  const previewUrl = `${window.location.origin}/status/${page.slug}`

  return (
    <>
      <DetailPageLayout
        embedded
        breadcrumbs={[
          { label: 'Status Pages', to: '/status-pages' },
          { label: 'View status page' },
        ]}
        title={`Status Page — ${page.name}`}
        badges={
          <>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${page.is_public ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
              {page.is_public ? 'Public' : 'Private'}
            </span>
            <TeamBadge teamId={page.team_id} teamName={page.team_name} />
          </>
        }
        sideMenu={
          <DetailSectionMenu
            basePath={basePath}
            defaultView="overview"
            sections={[
              {
                title: 'Basic',
                items: [
                  { id: 'overview', label: 'Overview', icon: <IconGrid /> },
                  { id: 'announcements', label: 'Announcements', icon: <IconFileText /> },
                ],
              },
              {
                title: 'Resources',
                items: [
                  { id: 'monitors', label: 'Monitors', icon: <IconActivity /> },
                  { id: 'groups', label: 'Groups', icon: <IconFolder /> },
                ],
              },
              {
                title: 'Subscribers',
                items: [
                  { id: 'subscribers-email', label: 'Email subscribers', icon: <IconMail /> },
                  { id: 'subscribers-sms', label: 'SMS subscribers', icon: <IconBell /> },
                ],
              },
              {
                title: 'Appearance',
                items: [
                  { id: 'branding', label: 'Branding & domain', icon: <IconSettings /> },
                ],
              },
            ]}
          />
        }
      >
        {activeView === 'overview' && (
          <OverviewPanel page={page} previewUrl={previewUrl} onEdit={() => setShowEdit(true)} />
        )}

        {activeView === 'announcements' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-500">Messages shown on the public page</p>
              <Button size="sm" onClick={() => setShowAddAnnouncement(true)}>+ New announcement</Button>
            </div>
            {!announcements || announcements.length === 0 ? (
              <EmptyPanel message="No announcements yet." />
            ) : (
              <div className="space-y-3">
                {announcements.map(a => (
                  <div key={a.id} className="card p-5">
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

        {activeView === 'monitors' && (
          <ResourceListPanel
            title="Monitors shown on the status page"
            resources={monitorResources}
            emptyMessage="No monitors added yet."
            onAdd={() => setShowAddMonitor(true)}
            onRemove={id => removeResourceMutation.mutate(id)}
          />
        )}

        {activeView === 'groups' && (
          <ResourceListPanel
            title="Monitor groups shown on the status page"
            resources={groupResources}
            emptyMessage="No groups added yet."
            onAdd={() => setShowAddGroup(true)}
            onRemove={id => removeResourceMutation.mutate(id)}
          />
        )}

        {activeView === 'subscribers-email' && (
          <SubscriberTable
            title="Email subscribers"
            subscribers={(subscribers ?? []).filter(s => s.email)}
            onRemove={id => removeSubscriberMutation.mutate(id)}
            mode="email"
          />
        )}

        {activeView === 'subscribers-sms' && (
          <SubscriberTable
            title="SMS subscribers"
            subscribers={(subscribers ?? []).filter(s => s.phone)}
            onRemove={id => removeSubscriberMutation.mutate(id)}
            mode="sms"
          />
        )}

        {activeView === 'branding' && (
          <BrandingForm pageId={id!} page={page} />
        )}
      </DetailPageLayout>

      <Modal open={showEdit} onClose={() => setShowEdit(false)} title="Edit status page">
        <EditStatusPageForm page={page} onClose={() => setShowEdit(false)} />
      </Modal>

      <Modal open={showAddMonitor} onClose={() => setShowAddMonitor(false)} title="Add monitor">
        <AddMonitorForm pageId={id!} monitors={monitorsData?.results ?? []} onClose={() => setShowAddMonitor(false)} />
      </Modal>

      <Modal open={showAddGroup} onClose={() => setShowAddGroup(false)} title="Add group">
        <AddGroupForm pageId={id!} groups={groupsData?.results ?? []} onClose={() => setShowAddGroup(false)} />
      </Modal>

      <Modal open={showAddAnnouncement} onClose={() => setShowAddAnnouncement(false)} title="New announcement">
        <AddAnnouncementForm pageId={id!} onClose={() => setShowAddAnnouncement(false)} />
      </Modal>
    </>
  )
}

function OverviewPanel({
  page,
  previewUrl,
  onEdit,
}: {
  page: StatusPage
  previewUrl: string
  onEdit: () => void
}) {
  const [copied, setCopied] = useState(false)

  const copyId = async () => {
    await navigator.clipboard.writeText(page.id)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <h3 className="section-title mb-2">Status page preview URL</h3>
        <p className="text-sm text-gray-500 mb-3">
          You can preview the status page by clicking on the link below.
        </p>
        <a
          href={previewUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-brand-600 hover:text-brand-700 break-all"
        >
          {previewUrl}
        </a>
      </div>

      <div className="card p-5">
        <div className="flex items-start justify-between gap-3 mb-5">
          <h3 className="section-title">Status page details</h3>
          <Button variant="secondary" size="sm" onClick={onEdit}>Edit status page</Button>
        </div>
        <dl className="space-y-4">
          <DetailField label="Status page ID">
            <div className="flex items-center gap-2">
              <code className="text-sm font-mono text-gray-700">{page.id}</code>
              <button
                type="button"
                onClick={copyId}
                className="text-xs text-brand-600 hover:text-brand-700 font-medium"
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </DetailField>
          <DetailField label="Status page name">{page.name}</DetailField>
          <DetailField label="Slug">
            <span className="font-mono text-sm">/status/{page.slug}</span>
          </DetailField>
          <DetailField label="Description">
            {page.description || <span className="text-gray-400">No description.</span>}
          </DetailField>
          {page.custom_domain && (
            <DetailField label="Custom domain">
              <span className="font-mono text-sm">{page.custom_domain}</span>
            </DetailField>
          )}
        </dl>
      </div>
    </div>
  )
}

function DetailField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">{label}</dt>
      <dd className="text-sm text-gray-800">{children}</dd>
    </div>
  )
}

function EmptyPanel({ message }: { message: string }) {
  return <div className="text-center py-12 text-gray-400 text-sm">{message}</div>
}

function ResourceListPanel({
  title,
  resources,
  emptyMessage,
  onAdd,
  onRemove,
}: {
  title: string
  resources: StatusPageResource[]
  emptyMessage: string
  onAdd: () => void
  onRemove: (id: string) => void
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">{title}</p>
        <Button size="sm" onClick={onAdd}>+ Add</Button>
      </div>
      {resources.length === 0 ? (
        <EmptyPanel message={emptyMessage} />
      ) : (
        <div className="space-y-2">
          {resources.map(r => (
            <div key={r.id} className="card p-4 flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-gray-400 text-sm shrink-0">#{r.order}</span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {r.display_name || r.monitor_name || r.group_name}
                  </p>
                  <p className="text-xs text-gray-400">{r.monitor ? 'Monitor' : 'Group'}</p>
                </div>
                {r.monitor_status && (
                  <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                    r.monitor_status === 'operational' ? 'bg-emerald-100 text-emerald-700' :
                    r.monitor_status === 'offline' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                  }`}>{r.monitor_status}</span>
                )}
              </div>
              <Button variant="danger" size="sm" onClick={() => onRemove(r.id)}>Remove</Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function SubscriberTable({
  title,
  subscribers,
  onRemove,
  mode,
}: {
  title: string
  subscribers: Subscriber[]
  onRemove: (id: string) => void
  mode: 'email' | 'sms'
}) {
  return (
    <div>
      <p className="text-sm text-gray-500 mb-4">{title} — {subscribers.length} subscriber(s)</p>
      {subscribers.length === 0 ? (
        <EmptyPanel message={`No ${mode} subscribers yet.`} />
      ) : (
        <div className="table-wrap">
          <div className="table-scroll">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  {mode === 'email' ? (
                    <>
                      <th className="table-th">Email</th>
                      <th className="table-th">Verified</th>
                      <th className="table-th">Subscribed on</th>
                    </>
                  ) : (
                    <>
                      <th className="table-th">Phone</th>
                      <th className="table-th">Email</th>
                      <th className="table-th">Verified</th>
                      <th className="table-th">Subscribed on</th>
                    </>
                  )}
                  <th className="table-th text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {subscribers.map(s => (
                  <tr key={s.id} className="hover:bg-gray-50/50">
                    {mode === 'email' ? (
                      <>
                        <td className="table-td text-gray-700">{s.email}</td>
                        <td className="table-td">
                          <span className={`text-xs font-medium ${s.is_verified ? 'text-emerald-600' : 'text-yellow-600'}`}>
                            {s.is_verified ? 'Verified' : 'Pending'}
                          </span>
                        </td>
                        <td className="table-td text-gray-500">{formatDate(s.subscribed_at)}</td>
                      </>
                    ) : (
                      <>
                        <td className="table-td font-mono text-gray-700">{s.phone}</td>
                        <td className="table-td text-gray-500">{s.email}</td>
                        <td className="table-td">
                          <span className={`text-xs font-medium ${s.phone_verified ? 'text-emerald-600' : 'text-yellow-600'}`}>
                            {s.phone_verified ? 'Verified' : 'Pending'}
                          </span>
                        </td>
                        <td className="table-td text-gray-500">{formatDate(s.subscribed_at)}</td>
                      </>
                    )}
                    <td className="table-td text-right">
                      <Button variant="danger" size="sm" onClick={() => onRemove(s.id)}>Delete</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function EditStatusPageForm({ page, onClose }: { page: StatusPage; onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    name: page.name,
    slug: page.slug,
    description: page.description ?? '',
    is_public: page.is_public,
  })
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: () => statusPagesApi.update(page.id, form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['status-page', page.id] })
      qc.invalidateQueries({ queryKey: ['status-pages'] })
      onClose()
    },
    onError: (err: any) => setError(err.response?.data?.errors?.[0]?.message || err.response?.data?.detail || 'Error.'),
  })

  return (
    <form onSubmit={e => { e.preventDefault(); setError(''); mutation.mutate() }} className="space-y-4">
      <div>
        <label className="label">Name</label>
        <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="input-field" />
      </div>
      <div>
        <label className="label">Slug</label>
        <input required value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') }))} className="input-field font-mono" />
      </div>
      <div>
        <label className="label">Description</label>
        <textarea rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="input-field resize-none" />
      </div>
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={form.is_public} onChange={e => setForm(f => ({ ...f, is_public: e.target.checked }))} className="rounded border-gray-300 text-brand-600" />
        <span className="text-sm text-gray-700">Public page</span>
      </label>
      {error && <p className="form-error">{error}</p>}
      <div className="form-actions">
        <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Saving…' : 'Save changes'}</Button>
      </div>
    </form>
  )
}

function AddMonitorForm({ pageId, monitors, onClose }: { pageId: string; monitors: { id: string; name: string }[]; onClose: () => void }) {
  const qc = useQueryClient()
  const [monitorId, setMonitorId] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: () => statusPagesApi.resources.add(pageId, { monitor_id: monitorId, display_name: displayName || undefined }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['status-page-resources', pageId] }); onClose() },
    onError: (err: any) => setError(err.response?.data?.errors?.[0]?.message || 'Error.'),
  })

  return (
    <div className="space-y-4">
      <div>
        <label className="label">Monitor</label>
        <select value={monitorId} onChange={e => setMonitorId(e.target.value)} className="input-field">
          <option value="">Select…</option>
          {monitors.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Display name <span className="text-gray-400 font-normal">(optional)</span></label>
        <input value={displayName} onChange={e => setDisplayName(e.target.value)} className="input-field" />
      </div>
      {error && <p className="form-error">{error}</p>}
      <div className="form-actions">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !monitorId}>
          {mutation.isPending ? 'Adding…' : 'Add'}
        </Button>
      </div>
    </div>
  )
}

function AddGroupForm({ pageId, groups, onClose }: { pageId: string; groups: { id: string; name: string }[]; onClose: () => void }) {
  const qc = useQueryClient()
  const [groupId, setGroupId] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: () => statusPagesApi.resources.add(pageId, { monitor_group_id: groupId, display_name: displayName || undefined }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['status-page-resources', pageId] }); onClose() },
    onError: (err: any) => setError(err.response?.data?.errors?.[0]?.message || 'Error.'),
  })

  return (
    <div className="space-y-4">
      <div>
        <label className="label">Monitor group</label>
        <select value={groupId} onChange={e => setGroupId(e.target.value)} className="input-field">
          <option value="">Select…</option>
          {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Display name <span className="text-gray-400 font-normal">(optional)</span></label>
        <input value={displayName} onChange={e => setDisplayName(e.target.value)} className="input-field" />
      </div>
      {error && <p className="form-error">{error}</p>}
      <div className="form-actions">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !groupId}>
          {mutation.isPending ? 'Adding…' : 'Add'}
        </Button>
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
    onError: (err: any) => setError(err.response?.data?.errors?.[0]?.message || 'Error.'),
  })

  return (
    <div className="space-y-4">
      <div>
        <label className="label">Title</label>
        <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="input-field" />
      </div>
      <div>
        <label className="label">Message</label>
        <textarea value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} rows={4} className="input-field resize-none" />
      </div>
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} className="rounded border-gray-300 text-brand-600" />
        <span className="text-sm text-gray-700">Show immediately</span>
      </label>
      {error && <p className="form-error">{error}</p>}
      <div className="form-actions">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !form.title || !form.message}>
          {mutation.isPending ? 'Publishing…' : 'Publish'}
        </Button>
      </div>
    </div>
  )
}

function BrandingForm({ pageId, page }: { pageId: string; page: StatusPage }) {
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
    onError: (err: any) => setError(err.response?.data?.errors?.[0]?.message || 'Error.'),
  })

  const domainMutation = useMutation({
    mutationFn: () => statusPagesApi.domain(pageId, domainForm),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['status-page', pageId] }),
  })

  return (
    <div className="space-y-6">
      <div className="card p-6 space-y-4">
        <h4 className="section-title">Appearance</h4>
        <div>
          <label className="label">Primary color</label>
          <div className="flex items-center gap-3">
            <input type="color" value={form.primary_color} onChange={e => setForm(f => ({ ...f, primary_color: e.target.value }))} className="w-10 h-10 rounded-lg border border-gray-300 cursor-pointer p-0.5" />
            <input value={form.primary_color} onChange={e => setForm(f => ({ ...f, primary_color: e.target.value }))} className="w-32 input-field font-mono" />
          </div>
        </div>
        <div>
          <label className="label">Logo URL</label>
          <input value={form.logo_url} onChange={e => setForm(f => ({ ...f, logo_url: e.target.value }))} className="input-field" placeholder="https://example.com/logo.png" />
        </div>
        <div>
          <label className="label">Custom CSS</label>
          <textarea value={form.custom_css} onChange={e => setForm(f => ({ ...f, custom_css: e.target.value }))} rows={6} className="input-field font-mono resize-none" />
        </div>
        {error && <p className="form-error">{error}</p>}
        {success && <p className="text-sm text-emerald-600 bg-emerald-50 rounded-lg px-3 py-2">Branding updated</p>}
        <Button onClick={() => brandingMutation.mutate()} disabled={brandingMutation.isPending}>
          {brandingMutation.isPending ? 'Saving…' : 'Save branding'}
        </Button>
      </div>

      <div className="card p-6 space-y-4">
        <h4 className="section-title">Custom domain</h4>
        <div>
          <label className="label">Domain</label>
          <input value={domainForm.custom_domain} onChange={e => setDomainForm({ custom_domain: e.target.value })} className="input-field" placeholder="status.example.com" />
        </div>
        <Button variant="secondary" onClick={() => domainMutation.mutate()} disabled={domainMutation.isPending}>
          {domainMutation.isPending ? 'Saving…' : 'Configure domain'}
        </Button>
      </div>
    </div>
  )
}
