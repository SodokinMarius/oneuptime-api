import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { incidentsApi } from '@/api/incidents'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { IconCheckCircle } from '@/components/ui/Icons'
import { formatRelative } from '@/utils/format'

export default function ActiveIncidentsView() {
  const { data, isLoading } = useQuery({
    queryKey: ['incidents', 'active-home'],
    queryFn: () => incidentsApi.list({ page_size: '50' }).then(r => r.data),
  })

  const incidents = (data?.results ?? []).filter(
    i => !i.is_resolved && i.state_name !== 'resolved'
  )

  if (isLoading) return <Spinner label="Loading incidents…" />

  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100">
        <h2 className="text-base font-semibold text-slate-900">Active Incidents</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          All unresolved incidents for this project.
        </p>
      </div>

      {incidents.length === 0 ? (
        <div className="flex flex-col items-center py-14 text-center px-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center mb-3">
            <IconCheckCircle size={22} className="text-emerald-500" />
          </div>
          <p className="text-sm font-medium text-slate-700">Nice work!</p>
          <p className="text-sm text-slate-400 mt-1">No active incidents so far.</p>
        </div>
      ) : (
        <div className="table-wrap border-0 shadow-none rounded-none">
          <div className="table-scroll">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60">
                  <th className="table-th">Title</th>
                  <th className="table-th hidden sm:table-cell">Severity</th>
                  <th className="table-th hidden md:table-cell">State</th>
                  <th className="table-th hidden lg:table-cell">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {incidents.map(inc => (
                  <tr key={inc.id} className="hover:bg-slate-50/50">
                    <td className="table-td">
                      <Link
                        to={`/incidents/${inc.id}`}
                        className="font-medium text-slate-900 hover:text-brand-600 transition-colors"
                      >
                        {inc.title}
                      </Link>
                    </td>
                    <td className="table-td hidden sm:table-cell">
                      {inc.severity_name && <Badge label={inc.severity_name} />}
                    </td>
                    <td className="table-td hidden md:table-cell">
                      {inc.state_name && <Badge label={inc.state_name} />}
                    </td>
                    <td className="table-td text-slate-400 hidden lg:table-cell">
                      {formatRelative(inc.created_at)}
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
