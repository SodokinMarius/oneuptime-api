import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { statusPagesApi } from '@/api/statusPages'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'
import { ListPageLayout } from '@/components/layout/ListPageLayout'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { IconGlobe, IconPlus } from '@/components/ui/Icons'
import { TeamBadge } from '@/components/ui/TeamBadge'
import { TeamFilter } from '@/components/ui/TeamFilter'
import { TeamSelect } from '@/components/ui/TeamSelect'
import { formatRelative } from '@/utils/format'
import { teamIdPayload, withTeamFilter } from '@/utils/teamParams'
import type { StatusPage } from '@/types'

type StatusPageView = 'all' | 'public' | 'private'

const VIEW_CONFIG: Record<StatusPageView, { title: string; subtitle: string; breadcrumb: string; emptyTitle: string; emptyDescription: string }> = {
  all: {
    title: 'Status Pages',
    subtitle: 'Here is a list of status pages for this project.',
    breadcrumb: 'All pages',
    emptyTitle: 'No status pages',
    emptyDescription: 'Create a public page to communicate the status of your services.',
  },
  public: {
    title: 'Public pages',
    subtitle: 'Status pages accessible without authentication.',
    breadcrumb: 'Public pages',
    emptyTitle: 'No public pages',
    emptyDescription: 'No public status pages configured.',
  },
  private: {
    title: 'Private pages',
    subtitle: 'Status pages requiring authentication.',
    breadcrumb: 'Private pages',
    emptyTitle: 'No private pages',
    emptyDescription: 'No private status pages configured.',
  },
}

function filterByView(pages: StatusPage[], view: StatusPageView): StatusPage[] {
  if (view === 'public') return pages.filter(p => p.is_public)
  if (view === 'private') return pages.filter(p => !p.is_public)
  return pages
}

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
  const [searchParams] = useSearchParams()
  const view = (searchParams.get('view') || 'all') as StatusPageView
  const config = VIEW_CONFIG[view] ?? VIEW_CONFIG.all

  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [teamFilter, setTeamFilter] = useState('')

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['status-pages', teamFilter, view],
    queryFn: () => statusPagesApi.list(withTeamFilter({}, teamFilter)).then(r => r.data),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => statusPagesApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['status-pages'] }),
  })

  const pages = filterByView(data?.results ?? [], view)

  return (
    <ListPageLayout
      embedded
      breadcrumbs={[
        { label: 'Status Pages', to: '/status-pages' },
        { label: config.breadcrumb },
      ]}
      title={config.title}
      subtitle={config.subtitle}
      actions={
        <Button onClick={() => setShowCreate(true)} fullWidth>
          <IconPlus size={16} />
          New page
        </Button>
      }
    >

      <div className="filter-bar">
        <TeamFilter value={teamFilter} onChange={setTeamFilter} />
      </div>

      {isLoading ? (
        <Spinner label="Loading…" />
      ) : pages.length === 0 ? (
        <EmptyState
          icon={<IconGlobe size={24} />}
          title={config.emptyTitle}
          description={config.emptyDescription}
          action={
            view === 'all' ? (
              <Button onClick={() => setShowCreate(true)}>Create page</Button>
            ) : (
              <Button variant="secondary" onClick={() => refetch()}>Refresh</Button>
            )
          }
        />
      ) : (
        <>
          <div className="table-wrap">
            <div className="table-scroll">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/60">
                    <th className="table-th">Name</th>
                    <th className="table-th hidden sm:table-cell">Slug</th>
                    <th className="table-th hidden md:table-cell">Description</th>
                    <th className="table-th hidden md:table-cell">Team</th>
                    <th className="table-th">Visibility</th>
                    <th className="table-th hidden lg:table-cell">Created</th>
                    <th className="table-th text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {pages.map(p => (
                    <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="table-td">
                        <Link
                          to={`/status-pages/${p.id}`}
                          className="font-medium text-gray-900 hover:text-brand-600 transition-colors truncate block max-w-[200px]"
                        >
                          {p.name}
                        </Link>
                      </td>
                      <td className="table-td hidden sm:table-cell">
                        <span className="font-mono text-xs text-brand-600">/status/{p.slug}</span>
                      </td>
                      <td className="table-td text-gray-500 hidden md:table-cell max-w-[240px] truncate">
                        {p.description || <span className="text-gray-300">—</span>}
                      </td>
                      <td className="table-td hidden md:table-cell">
                        <TeamBadge teamId={p.team_id} teamName={p.team_name} />
                      </td>
                      <td className="table-td">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.is_public ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                          {p.is_public ? 'Public' : 'Private'}
                        </span>
                      </td>
                      <td className="table-td text-gray-400 hidden lg:table-cell whitespace-nowrap">
                        {formatRelative(p.created_at)}
                      </td>
                      <td className="table-td">
                        <div className="flex items-center gap-1.5 justify-end">
                          <Link to={`/status-pages/${p.id}`} className="btn-secondary btn-sm">
                            Manage
                          </Link>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => { if (confirm('Delete this page?')) deleteMut.mutate(p.id) }}
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <p className="text-sm text-gray-500 mt-4">
            {pages.length} page{pages.length !== 1 ? 's' : ''} shown.
          </p>
        </>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New status page">
        <StatusPageForm onSuccess={() => { setShowCreate(false); qc.invalidateQueries({ queryKey: ['status-pages'] }) }} />
      </Modal>
    </ListPageLayout>
  )
}
