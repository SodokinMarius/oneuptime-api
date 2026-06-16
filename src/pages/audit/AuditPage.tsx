import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { auditApi } from '@/api/audit'
import { formatDate } from '@/utils/format'

const ACTOR_TYPES = ['', 'user', 'api_key', 'system']
const RESOURCE_TYPES = ['', 'incident', 'monitor', 'role', 'team', 'project', 'webhook', 'api_key', 'user']

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
      page_size: '30',
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
  const totalPages = data?.count ? Math.max(1, Math.ceil(data.count / 30)) : 1

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
          {ACTOR_TYPES.map(t => <option key={t} value={t}>{t || 'Tous les acteurs'}</option>)}
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
                        <div className="flex items-center gap-1.5">
                          <span className={`text-xs px-1.5 py-0.5 rounded ${
                            entry.actor_type === 'user' ? 'bg-blue-100 text-blue-600' :
                            entry.actor_type === 'api_key' ? 'bg-purple-100 text-purple-600' :
                            'bg-gray-100 text-gray-500'
                          }`}>{entry.actor_type}</span>
                          <span className="text-gray-700 truncate max-w-[140px]">{entry.actor_label}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-400 font-mono text-xs">{entry.ip_address ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-4 py-3 border-t border-gray-200">
                <span className="text-sm text-gray-500">{data?.count} entrées au total</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors">
                    ← Préc.
                  </button>
                  <span className="text-sm text-gray-600">Page {page} / {totalPages}</span>
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors">
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
