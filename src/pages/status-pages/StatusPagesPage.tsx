import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { statusPagesApi } from '@/api/statusPages'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'
import { IconGlobe } from '@/components/ui/Icons'
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
        setError('Une erreur est survenue.')
      }
    },
  })

  return (
    <form onSubmit={e => { e.preventDefault(); setError(''); mut.mutate() }} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
        <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Status de production" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Slug (URL) *</label>
        <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500">
          <span className="px-3 py-2 bg-gray-50 text-gray-500 text-sm border-r border-gray-300">/status/</span>
          <input required value={form.slug}
            onChange={e => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })}
            className="flex-1 px-3 py-2 text-sm outline-none" placeholder="ma-page" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <textarea rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={form.is_public} onChange={e => setForm({ ...form, is_public: e.target.checked })} className="rounded" />
        Page publique (accessible sans authentification)
      </label>
      <TeamSelect value={teamId} onChange={setTeamId} />
      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>}
      <div className="flex justify-end pt-1">
        <button type="submit" disabled={mut.isPending}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium px-5 py-2 rounded-lg text-sm transition-colors">
          {mut.isPending ? 'Création...' : 'Créer la page'}
        </button>
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
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Status Pages</h2>
          <p className="text-sm text-gray-500 mt-0.5">{data?.count ?? 0} page{(data?.count ?? 0) > 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors w-full sm:w-auto">
          + Nouvelle page
        </button>
      </div>

      <div className="mb-6">
        <TeamFilter value={teamFilter} onChange={setTeamFilter} />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : pages.length === 0 ? (
        <EmptyState icon={<IconGlobe size={24} />} title="Aucune status page"
          description="Créez une page publique pour communiquer l'état de vos services."
          action={
            <button onClick={() => setShowCreate(true)} className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg">
              Créer une page
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {pages.map(p => (
            <div key={p.id} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-sm transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-900">{p.name}</h3>
                  <span className="text-xs text-blue-600 font-mono">/status/{p.slug}</span>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.is_public ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                    {p.is_public ? 'Public' : 'Privé'}
                  </span>
                  <TeamBadge teamId={p.team_id} teamName={p.team_name} />
                </div>
              </div>
              {p.description && <p className="text-sm text-gray-500 mb-3 line-clamp-2">{p.description}</p>}
              <p className="text-xs text-gray-400 mb-4">Créée {formatRelative(p.created_at)}</p>
              <div className="flex gap-2">
                <Link to={`/status-pages/${p.id}`}
                  className="flex-1 text-center text-xs border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">
                  Gérer
                </Link>
                <a href={`/status/${p.slug}`} target="_blank" rel="noreferrer"
                  className="text-xs border border-blue-200 text-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors">
                  ↗
                </a>
                <button onClick={() => { if (confirm('Supprimer cette page ?')) deleteMut.mutate(p.id) }}
                  className="text-xs border border-red-200 text-red-500 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors">
                  Suppr.
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Nouvelle status page">
        <StatusPageForm onSuccess={() => { setShowCreate(false); qc.invalidateQueries({ queryKey: ['status-pages'] }) }} />
      </Modal>
    </div>
  )
}
