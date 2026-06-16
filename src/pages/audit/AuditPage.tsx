import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { auditApi } from '@/api/audit'
import { formatDate } from '@/utils/format'

const PAGE_SIZE = 30
const ACTOR_TYPES = ['', 'user', 'api_key', 'system'] as const
const ACTOR_TYPE_LABELS: Record<string, string> = {
  user: 'Utilisateur',
  api_key: 'Clé API',
  system: 'Automatique',
  scim: 'SCIM',
}
const RESOURCE_TYPES = ['', 'incident', 'monitor', 'role', 'team', 'project', 'webhook', 'api_key', 'user']

function actorTypeLabel(type: string) {
  return ACTOR_TYPE_LABELS[type] ?? type
}

export default function AuditPage() {
  const [filters, setFilters] = useState({
    action: '', resource_type: '', actor_type: '', since: '', until: '',
  })
  const [page, setPage] = useState(1)
  const [verifying, setVerifying] = useState(false)
  const [verifyResult, setVerifyResult] = useState<{ valid: boolean; checked: number } | null>(null)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['audit-log', filters, page],
    queryFn: () => auditApi.list({
      ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)),
      page: String(page),
      page_size: String(PAGE_SIZE),
    }).then(r => r.data),
  })

  const handleVerify = async () => {
    setVerifying(true)
    try {
      const res = await auditApi.verify()
      setVerifyResult(res.data)
    } finally {
      setVerifying(false)
    }
  }

  const handleExport = async (format: 'csv' | 'jsonl') => {
    const res = await auditApi.export(format)
    const url = URL.createObjectURL(res.data as Blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `audit-log.${format}`
    a.click()
    URL.revokeObjectURL(url)
  }

  const entries = data?.results ?? []
  const totalCount = data?.count
  const totalPages = totalCount != null ? Math.max(1, Math.ceil(totalCount / PAGE_SIZE)) : null
  const hasNextPage = totalPages != null ? page < totalPages : Boolean(data?.next)
  const hasPrevPage = page > 1

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Journal d'audit</h2>
          <p className="text-gray-500 text-sm mt-1">Log immuable en chaîne de hash SHA-256</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={handleVerify} disabled={verifying}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 whitespace-nowrap">
            {verifying ? 'Vérification...' : '🔐 Vérifier intégrité'}
          </button>
          <button onClick={() => handleExport('csv')}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
            ↓ CSV
          </button>
          <button onClick={() => handleExport('jsonl')}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
            ↓ JSONL
          </button>
        </div>
      </div>

      {verifyResult && (
        <div className={`rounded-xl p-4 mb-6 border flex items-center gap-3 ${verifyResult.valid ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
          <span>{verifyResult.valid ? '✅' : '❌'}</span>
          <span className="text-sm font-medium">
            {verifyResult.valid
              ? `Chaîne intègre — ${verifyResult.checked} entrées vérifiées`
              : `Intégrité compromise — ${verifyResult.checked} entrées vérifiées`}
          </span>
          <button onClick={() => setVerifyResult(null)} className="ml-auto text-sm opacity-60 hover:opacity-100">×</button>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <input value={filters.action} onChange={e => { setFilters(f => ({ ...f, action: e.target.value })); setPage(1) }}
          placeholder="Action..." className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <select value={filters.resource_type} onChange={e => { setFilters(f => ({ ...f, resource_type: e.target.value })); setPage(1) }}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          {RESOURCE_TYPES.map(t => <option key={t} value={t}>{t || 'Toutes les ressources'}</option>)}
        </select>
        <select value={filters.actor_type} onChange={e => { setFilters(f => ({ ...f, actor_type: e.target.value })); setPage(1) }}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          {ACTOR_TYPES.map(t => <option key={t} value={t}>{t ? actorTypeLabel(t) : 'Tous les acteurs'}</option>)}
        </select>
        <input type="date" value={filters.since} onChange={e => { setFilters(f => ({ ...f, since: e.target.value })); setPage(1) }}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <input type="date" value={filters.until} onChange={e => { setFilters(f => ({ ...f, until: e.target.value })); setPage(1) }}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : entries.length === 0 ? (
          <p className="text-center text-gray-400 py-16 text-sm">
            {isError
              ? 'Impossible de charger le journal d\'audit.'
              : 'Aucune entrée dans le journal. Les actions (monitors, incidents, clés API…) apparaîtront ici.'}
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Date</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Action</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Ressource</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Acteur</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">IP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {entries.map(entry => (
                    <tr key={entry.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDate(entry.created_at)}</td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">{entry.action}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-gray-700">{entry.resource_type}</span>
                        {entry.resource_id && (
                          <span className="text-gray-400 font-mono text-xs ml-1">#{entry.resource_id.slice(0, 8)}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-0.5 min-w-0">
                          <span className="text-gray-800 truncate max-w-[220px]" title={entry.actor_label}>
                            {entry.actor_label}
                          </span>
                          <span className={`text-xs px-1.5 py-0.5 rounded w-fit ${
                            entry.actor_type === 'user' ? 'bg-blue-100 text-blue-600' :
                            entry.actor_type === 'api_key' ? 'bg-purple-100 text-purple-600' :
                            'bg-gray-100 text-gray-500'
                          }`}>{actorTypeLabel(entry.actor_type)}</span>
                        </div>
                      </td>
                      <td
                        className="px-4 py-3 text-gray-400 font-mono text-xs"
                        title={entry.ip_address ? undefined : entry.actor_type === 'system' ? 'Action automatique (scheduler) — pas d\'IP' : 'IP non enregistrée'}
                      >
                        {entry.ip_address ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Pagination — visible dès qu'il y a des entrées */}
            {entries.length > 0 && (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
                <span className="text-sm text-gray-500">
                  {totalCount != null
                    ? `${totalCount} entrée${totalCount > 1 ? 's' : ''} au total`
                    : `${entries.length} entrée${entries.length > 1 ? 's' : ''} affichée${entries.length > 1 ? 's' : ''}`}
                  {totalPages != null && (
                    <span className="text-gray-400"> · {PAGE_SIZE} par page</span>
                  )}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={!hasPrevPage}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-white transition-colors"
                  >
                    ← Préc.
                  </button>
                  <span className="text-sm text-gray-600 min-w-[7rem] text-center">
                    {totalPages != null ? `Page ${page} / ${totalPages}` : `Page ${page}`}
                  </span>
                  <button
                    onClick={() => setPage(p => p + 1)}
                    disabled={!hasNextPage}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-white transition-colors"
                  >
                    Suiv. →
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
