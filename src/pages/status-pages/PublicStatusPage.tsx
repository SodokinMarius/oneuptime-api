import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { statusPagesApi } from '@/api/statusPages'
import { formatDate } from '@/utils/format'

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  operational: { label: 'Opérationnel', color: 'text-emerald-700', bg: 'bg-emerald-100' },
  degraded: { label: 'Dégradé', color: 'text-yellow-700', bg: 'bg-yellow-100' },
  offline: { label: 'Hors ligne', color: 'text-red-700', bg: 'bg-red-100' },
  disabled: { label: 'Désactivé', color: 'text-gray-600', bg: 'bg-gray-100' },
}

function statusBadge(status?: string | null) {
  const key = status ?? 'operational'
  const cfg = STATUS_LABELS[key] ?? { label: status ?? 'Inconnu', color: 'text-gray-600', bg: 'bg-gray-100' }
  return (
    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${cfg.bg} ${cfg.color}`}>
      {cfg.label}
    </span>
  )
}

export default function PublicStatusPage() {
  const { slug } = useParams<{ slug: string }>()

  const { data: page, isLoading, error } = useQuery({
    queryKey: ['public-status-page', slug],
    queryFn: () => statusPagesApi.getPublic(slug!).then(r => r.data),
    enabled: !!slug,
    retry: false,
  })

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error || !page) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center max-w-md">
          <p className="text-4xl mb-3">🔍</p>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Page de statut introuvable</h1>
          <p className="text-sm text-gray-500">
            Vérifiez que la page est <strong>publique</strong> et que le slug est correct.
          </p>
        </div>
      </div>
    )
  }

  const accent = page.primary_color || '#0066cc'

  return (
    <div className="min-h-screen bg-gray-50">
      {page.custom_css && <style>{page.custom_css}</style>}

      <header className="bg-white border-b border-gray-200" style={{ borderTopColor: accent, borderTopWidth: 4 }}>
        <div className="max-w-3xl mx-auto px-6 py-8">
          <div className="flex items-center gap-4">
            {page.logo_url && (
              <img src={page.logo_url} alt="" className="h-10 w-auto object-contain" />
            )}
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{page.name}</h1>
              {page.description && <p className="text-sm text-gray-500 mt-1">{page.description}</p>}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        {page.announcements?.length > 0 && (
          <section className="space-y-3">
            {page.announcements.map(a => (
              <div key={a.id} className="bg-blue-50 border border-blue-200 rounded-xl p-5">
                <h2 className="text-sm font-semibold text-blue-900 mb-1">{a.title}</h2>
                <p className="text-sm text-blue-800 whitespace-pre-wrap">{a.content}</p>
                <p className="text-xs text-blue-600 mt-2">{formatDate(a.starts_at)}</p>
              </div>
            ))}
          </section>
        )}

        <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">État des services</h2>
          </div>
          {page.resources.length === 0 ? (
            <p className="px-6 py-12 text-center text-sm text-gray-400">
              Aucun service configuré sur cette page.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {page.resources.map(r => {
                const label = r.display_name || r.monitor_name || r.group_name || 'Service'
                return (
                  <li key={r.id} className="px-6 py-4 flex items-center justify-between gap-4">
                    <span className="text-sm font-medium text-gray-800">{label}</span>
                    {statusBadge(r.monitor_status)}
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <p className="text-center text-xs text-gray-400 pt-4">
          Propulsé par OneUptime
        </p>
      </main>
    </div>
  )
}
