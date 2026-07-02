import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { statusPagesApi } from '@/api/statusPages'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageShell } from '@/components/ui/PageShell'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { IconGlobe, IconPlus } from '@/components/ui/Icons'
import { TeamBadge } from '@/components/ui/TeamBadge'
import { TeamFilter } from '@/components/ui/TeamFilter'
import { TeamSelect } from '@/components/ui/TeamSelect'
import { formatRelative } from '@/utils/format'
import { teamIdPayload, withTeamFilter } from '@/utils/teamParams'

function StatusPageForm({ onSuccess }: { onSuccess: () => void }) {
  const [teamId, setTeamId] = useState('')
  const [form, setForm] = useState({ name: '', slug: '', description: '', is_public: true })
  const [error, setError] = useState('')

  const mut = useMutation({
    mutationFn: () => statusPagesApi.create({ ...form, ...teamIdPayload(teamId) }),
    onSuccess,
    onError: (err: any) => {
      const d = err.response?.data
      if (d?.errors?.length) {
        setError(d.errors.map((e: any) => e.field ? `${e.field} : ${e.message}` : e.message).join('\n'))
      } else if (d?.detail) {
        setError(d.detail)
      } else if (typeof d === 'object') {
        setError(Object.entries(d).map(([k, v]) => `${k} : ${Array.isArray(v) ? v.join(', ') : v}`).join('\n'))
      } else {
        setError('An error occurred.')
      }
    },
  })

  return (
    <form onSubmit={e => { e.preventDefault(); setError(''); mut.mutate() }} className="space-y-4">
      <div>
        <label className="label">Name *</label>
        <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
          className="input-field" placeholder="Production status" />
      </div>
      <div>
        <label className="label">Slug (URL) *</label>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center border border-gray-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-brand-500">
          <span className="px-3 py-2.5 bg-gray-50 text-gray-500 text-sm border-b sm:border-b-0 sm:border-r border-gray-200 shrink-0">/status/</span>
          <input required value={form.slug}
            onChange={e => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })}
            className="flex-1 px-3 py-2.5 text-sm outline-none bg-white" placeholder="my-page" />
        </div>
      </div>
      <div>
        <label className="label">Description</label>
        <textarea rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
          className="input-field resize-none" />
      </div>
      <label className="flex items-start sm:items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={form.is_public} onChange={e => setForm({ ...form, is_public: e.target.checked })} className="rounded mt-0.5 sm:mt-0 text-brand-600 focus:ring-brand-500" />
        Public page (accessible without authentication)
      </label>
      <TeamSelect value={teamId} onChange={setTeamId} />
      {error && <div className="form-error whitespace-pre-line">{error}</div>}
      <div className="form-actions">
        <Button type="submit" disabled={mut.isPending}>
          {mut.isPending ? 'Creating…' : 'Create page'}
        </Button>
      </div>
    </form>
  )
}

export default function StatusPagesPage() {
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [teamFilter, setTeamFilter] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['status-pages', teamFilter],
    queryFn: () => statusPagesApi.list(withTeamFilter({}, teamFilter)).then(r => r.data),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => statusPagesApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['status-pages'] }),
  })

  const pages = data?.results ?? []

  return (
    <PageShell>
      <PageHeader
        title="Status Pages"
        subtitle={`${data?.count ?? 0} page${(data?.count ?? 0) > 1 ? 's' : ''}`}
        actions={
          <Button onClick={() => setShowCreate(true)} fullWidth>
            <IconPlus size={16} />
            New page
          </Button>
        }
      />

      <div className="filter-bar">
        <TeamFilter value={teamFilter} onChange={setTeamFilter} />
      </div>

      {isLoading ? (
        <Spinner label="Loading…" />
      ) : pages.length === 0 ? (
        <EmptyState
          icon={<IconGlobe size={24} />}
          title="No status pages"
          description="Create a public page to communicate the status of your services."
          action={<Button onClick={() => setShowCreate(true)}>Create page</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {pages.map(p => (
            <div key={p.id} className="card p-4 sm:p-5 hover:shadow-md transition-all duration-200 flex flex-col">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate">{p.name}</h3>
                  <span className="text-xs text-brand-600 font-mono">/status/{p.slug}</span>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.is_public ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                    {p.is_public ? 'Public' : 'Private'}
                  </span>
                  <TeamBadge teamId={p.team_id} teamName={p.team_name} />
                </div>
              </div>
              {p.description && <p className="text-sm text-gray-500 mb-3 line-clamp-2 flex-1">{p.description}</p>}
              <p className="text-xs text-gray-400 mb-4">Created {formatRelative(p.created_at)}</p>
              <div className="flex flex-wrap gap-2 mt-auto">
                <Link to={`/status-pages/${p.id}`} className="btn-secondary btn-sm flex-1 text-center justify-center">
                  Manage
                </Link>
                <a href={`/status/${p.slug}`} target="_blank" rel="noreferrer" className="btn-secondary btn-sm">
                  Open ↗
                </a>
                <Button variant="danger" size="sm" onClick={() => { if (confirm('Delete this page?')) deleteMut.mutate(p.id) }}>
                  Del.
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New status page">
        <StatusPageForm onSuccess={() => { setShowCreate(false); qc.invalidateQueries({ queryKey: ['status-pages'] }) }} />
      </Modal>
    </PageShell>
  )
}
