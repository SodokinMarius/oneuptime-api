import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { maintenanceApi } from '@/api/maintenance'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { IconCheckCircle } from '@/components/ui/Icons'
import { formatDate } from '@/utils/format'

export default function OngoingMaintenanceView() {
  const { data, isLoading } = useQuery({
    queryKey: ['maintenance', 'ongoing-home'],
    queryFn: () => maintenanceApi.list({ status: 'in_progress' }).then(r => r.data),
  })

  const items = data?.results ?? []

  if (isLoading) return <Spinner label="Loading maintenance…" />

  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100">
        <h2 className="text-base font-semibold text-slate-900">Ongoing Maintenance</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Maintenance windows currently in progress.
        </p>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center py-14 text-center px-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center mb-3">
            <IconCheckCircle size={22} className="text-emerald-500" />
          </div>
          <p className="text-sm font-medium text-slate-700">No ongoing maintenance</p>
          <p className="text-sm text-slate-400 mt-1">No scheduled events are running right now.</p>
        </div>
      ) : (
        <div className="table-wrap border-0 shadow-none rounded-none">
          <div className="table-scroll">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60">
                  <th className="table-th">Title</th>
                  <th className="table-th hidden sm:table-cell">Status</th>
                  <th className="table-th hidden md:table-cell">Starts</th>
                  <th className="table-th hidden lg:table-cell">Ends</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {items.map(mw => (
                  <tr key={mw.id} className="hover:bg-slate-50/50">
                    <td className="table-td">
                      <Link
                        to="/maintenance"
                        className="font-medium text-slate-900 hover:text-brand-600 transition-colors"
                      >
                        {mw.title}
                      </Link>
                      {mw.description && (
                        <p className="text-xs text-slate-400 mt-0.5 truncate max-w-md">{mw.description}</p>
                      )}
                    </td>
                    <td className="table-td hidden sm:table-cell">
                      <Badge label={mw.status} />
                    </td>
                    <td className="table-td text-slate-400 hidden md:table-cell">
                      {formatDate(mw.starts_at)}
                    </td>
                    <td className="table-td text-slate-400 hidden lg:table-cell">
                      {formatDate(mw.ends_at)}
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
