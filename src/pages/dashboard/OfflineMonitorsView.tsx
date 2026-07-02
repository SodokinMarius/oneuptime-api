import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { monitorsApi } from '@/api/monitors'
import { StatusDot } from '@/components/ui/StatusDot'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { IconCheckCircle } from '@/components/ui/Icons'
import { formatRelative } from '@/utils/format'

export default function OfflineMonitorsView() {
  const { data, isLoading } = useQuery({
    queryKey: ['monitors', 'offline-home'],
    queryFn: () => monitorsApi.list().then(r => r.data),
  })

  const monitors = (data?.results ?? []).filter(
    m => m.status === 'offline' || m.status === 'degraded'
  )

  if (isLoading) return <Spinner label="Loading monitors…" />

  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100">
        <h2 className="text-base font-semibold text-slate-900">Inoperational Monitors</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Monitors that are offline or degraded.
        </p>
      </div>

      {monitors.length === 0 ? (
        <div className="flex flex-col items-center py-14 text-center px-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center mb-3">
            <IconCheckCircle size={22} className="text-emerald-500" />
          </div>
          <p className="text-sm font-medium text-slate-700">All monitors operational</p>
          <p className="text-sm text-slate-400 mt-1">No inoperational monitors right now.</p>
        </div>
      ) : (
        <div className="table-wrap border-0 shadow-none rounded-none">
          <div className="table-scroll">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60">
                  <th className="table-th">Name</th>
                  <th className="table-th hidden sm:table-cell">Type</th>
                  <th className="table-th">Status</th>
                  <th className="table-th hidden md:table-cell">Last check</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {monitors.map(m => (
                  <tr key={m.id} className="hover:bg-slate-50/50">
                    <td className="table-td">
                      <Link
                        to={`/monitors/${m.id}`}
                        className="flex items-center gap-2 font-medium text-slate-900 hover:text-brand-600 transition-colors"
                      >
                        <StatusDot status={m.status} />
                        <span className="truncate">{m.name}</span>
                      </Link>
                    </td>
                    <td className="table-td text-slate-500 capitalize hidden sm:table-cell">{m.type}</td>
                    <td className="table-td">
                      <Badge label={m.status} />
                    </td>
                    <td className="table-td text-slate-400 hidden md:table-cell">
                      {formatRelative(m.last_check_at)}
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
