import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { auditApi } from '@/api/audit'
import { PageShell } from '@/components/ui/PageShell'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
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
    <PageShell size="wide">
      <PageHeader
        title="Journal d'audit"
        subtitle="Log immuable en chaîne de hash SHA-256"
        actions={
          <>
            <Button variant="secondary" onClick={handleVerify} disabled={verifying}>
              {verifying ? 'Vérification…' : 'Vérifier intégrité'}
            </Button>
            <Button variant="secondary" onClick={() => handleExport('csv')}>↓ CSV</Button>
            <Button variant="secondary" onClick={() => handleExport('jsonl')}>↓ JSONL</Button>
          </>
        }
      />

      {verifyResult && (
        <div className={`rounded-xl p-4 mb-6 border flex items-center gap-3 ${verifyResult.valid ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
          <span>{verifyResult.valid ? '✅' : '❌'}</span>
          <span className="text-sm font-medium">
            {verifyResult.valid
              ? `Chaîne intègre — ${verifyResult.checked} entrées vérifiées`
              : `Intégrité compromise — ${verifyResult.checked} entrées vérifiées`}
          </span>
          <button onClick={() => setVerifyResult(null)} className="ml-auto btn-ghost btn-sm">×</button>
        </div>
      )}

      <div className="card p-4 mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
        <input
          value={filters.action}
          onChange={e => { setFilters(f => ({ ...f, action: e.target.value })); setPage(1) }}
          placeholder="Action…"
          className="input-field"
        />
        <select
          value={filters.resource_type}
          onChange={e => { setFilters(f => ({ ...f, resource_type: e.target.value })); setPage(1) }}
          className="input-field"
        >
          {RESOURCE_TYPES.map(t => <option key={t} value={t}>{t || 'Toutes les ressources'}</option>)}
        </select>
        <select
          value={filters.actor_type}
          onChange={e => { setFilters(f => ({ ...f, actor_type: e.target.value })); setPage(1) }}
          className="input-field"
        >
          {ACTOR_TYPES.map(t => <option key={t} value={t}>{t ? actorTypeLabel(t) : 'Tous les acteurs'}</option>)}
        </select>
        <input
          type="date"
          value={filters.since}
          onChange={e => { setFilters(f => ({ ...f, since: e.target.value })); setPage(1) }}
          className="input-field"
        />
        <input
          type="date"
          value={filters.until}
          onChange={e => { setFilters(f => ({ ...f, until: e.target.value })); setPage(1) }}
          className="input-field"
        />
      </div>

      <div className="table-wrap">
        {isLoading ? (
          <Spinner label="Chargement…" />
        ) : entries.length === 0 ? (
          <p className="text-center text-gray-400 py-16 text-sm px-4">
            {isError
              ? 'Impossible de charger le journal d\'audit.'
              : 'Aucune entrée dans le journal. Les actions apparaîtront ici.'}
          </p>
        ) : (
          <>
            <div className="table-scroll">
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/60">
                    <th className="table-th">Date</th>
                    <th className="table-th">Action</th>
                    <th className="table-th">Ressource</th>
                    <th className="table-th">Acteur</th>
                    <th className="table-th">IP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {entries.map(entry => (
                    <tr key={entry.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="table-td text-gray-500 whitespace-nowrap">{formatDate(entry.created_at)}</td>
                      <td className="table-td">
                        <span className="font-mono text-xs bg-brand-50 text-brand-700 px-2 py-0.5 rounded">{entry.action}</span>
                      </td>
                      <td className="table-td">
                        <span className="text-gray-700">{entry.resource_type}</span>
                        {entry.resource_id && (
                          <span className="text-gray-400 font-mono text-xs ml-1">#{entry.resource_id.slice(0, 8)}</span>
                        )}
                      </td>
                      <td className="table-td">
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
                        className="table-td text-gray-400 font-mono text-xs"
                        title={entry.ip_address ? undefined : entry.actor_type === 'system' ? 'Action automatique — pas d\'IP' : 'IP non enregistrée'}
                      >
                        {entry.ip_address ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="pagination-bar">
              <span className="text-sm text-gray-500">
                {totalCount != null
                  ? `${totalCount} entrée${totalCount > 1 ? 's' : ''} au total`
                  : `${entries.length} entrée${entries.length > 1 ? 's' : ''} affichée${entries.length > 1 ? 's' : ''}`}
                {totalPages != null && (
                  <span className="text-gray-400"> · {PAGE_SIZE} par page</span>
                )}
              </span>
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={!hasPrevPage}>
                  ← Préc.
                </Button>
                <span className="text-sm text-gray-600 min-w-[7rem] text-center">
                  {totalPages != null ? `Page ${page} / ${totalPages}` : `Page ${page}`}
                </span>
                <Button variant="secondary" size="sm" onClick={() => setPage(p => p + 1)} disabled={!hasNextPage}>
                  Suiv. →
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </PageShell>
  )
}
