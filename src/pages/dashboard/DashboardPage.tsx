import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { monitorsApi } from '@/api/monitors'
import { incidentsApi } from '@/api/incidents'
import { maintenanceApi } from '@/api/maintenance'
import { authStore } from '@/store/auth'
import { StatusDot } from '@/components/ui/StatusDot'
import { Badge } from '@/components/ui/Badge'
import { formatRelative } from '@/utils/format'
import {
  IconActivity,
  IconCheckCircle,
  IconAlertTriangle,
  IconCalendar,
  IconArrowRight,
  IconMonitor,
  IconZap,
  IconRefreshCw,
  IconTrendingUp,
  IconGlobe,
} from '@/components/ui/Icons'
import { PageShell } from '@/components/ui/PageShell'

export default function DashboardPage() {
  const user = authStore.getUser()

  const { data: monitors } = useQuery({
    queryKey: ['monitors', '', ''],
    queryFn: () => monitorsApi.list().then(r => r.data),
  })

  const { data: incidents } = useQuery({
    queryKey: ['incidents', ''],
    queryFn: () => incidentsApi.list({ page_size: '5' }).then(r => r.data),
  })

  const { data: maintenance } = useQuery({
    queryKey: ['maintenance'],
    queryFn: () => maintenanceApi.list({ status: 'scheduled' }).then(r => r.data),
  })

  const monitorList = monitors?.results ?? []
  const incidentList = incidents?.results ?? []
  const maintenanceList = maintenance?.results ?? []

  const operational = monitorList.filter(m => m.status === 'operational').length
  const offline = monitorList.filter(m => m.status === 'offline' || m.status === 'degraded').length
  const openIncidents = incidentList.filter(i => !i.is_resolved && i.state_name !== 'resolved').length

  const overallStatus: 'operational' | 'degraded' | 'disabled' =
    offline > 0 ? 'degraded'
    : operational === monitorList.length && monitorList.length > 0 ? 'operational'
    : 'disabled'

  const stats = [
    {
      label: 'Active monitors',
      value: monitors?.count ?? '—',
      icon: IconActivity,
      color: 'text-brand-600',
      bg: 'bg-brand-50',
      iconColor: 'text-brand-500',
      href: '/monitors',
    },
    {
      label: 'Operational',
      value: operational || '—',
      icon: IconCheckCircle,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      iconColor: 'text-emerald-500',
      href: '/monitors',
    },
    {
      label: 'Open incidents',
      value: openIncidents || '—',
      icon: IconAlertTriangle,
      color: openIncidents > 0 ? 'text-red-500' : 'text-gray-400',
      bg: openIncidents > 0 ? 'bg-red-50' : 'bg-gray-50',
      iconColor: openIncidents > 0 ? 'text-red-400' : 'text-gray-400',
      href: '/incidents',
    },
    {
      label: 'Scheduled maintenance',
      value: maintenanceList.length || '—',
      icon: IconCalendar,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      iconColor: 'text-amber-500',
      href: '/maintenance',
    },
  ]

  const statusConfig = {
    operational: {
      bg: 'bg-emerald-50 border-emerald-200',
      text: 'text-emerald-700',
      label: 'All services are operational',
    },
    degraded: {
      bg: 'bg-red-50 border-red-200',
      text: 'text-red-700',
      label: `${offline} service${offline > 1 ? 's' : ''} down or degraded`,
    },
    disabled: {
      bg: 'bg-gray-50 border-gray-200',
      text: 'text-gray-500',
      label: 'No monitors configured',
    },
  }

  const sc = statusConfig[overallStatus]

  return (
    <PageShell>

      {/* Header */}
      <div className="mb-7 flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
            Hello, {user?.first_name}
          </h2>
          <p className="text-gray-400 text-sm mt-1">Overview of your infrastructure</p>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-xs text-gray-400 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
          <IconRefreshCw size={13} className="text-gray-400" />
          Real-time updates
        </div>
      </div>

      {/* Global status banner */}
      <div className={`rounded-xl border px-5 py-3.5 mb-8 flex items-center gap-3 ${sc.bg}`}>
        <StatusDot status={overallStatus} />
        <span className={`font-medium text-sm ${sc.text}`}>{sc.label}</span>
        {overallStatus === 'operational' && (
          <span className="ml-auto text-xs text-emerald-600 font-medium">100% operational</span>
        )}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map(({ label, value, icon: Icon, color, bg, iconColor, href }) => (
          <Link
            key={label}
            to={href}
            className="card p-5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group"
          >
            <div className="flex items-start justify-between mb-3">
              <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center`}>
                <Icon size={17} className={iconColor} />
              </div>
              <IconArrowRight size={14} className="text-gray-300 group-hover:text-brand-400 group-hover:translate-x-0.5 transition-all" />
            </div>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-gray-400 mt-1 font-medium">{label}</p>
          </Link>
        ))}
      </div>

      {/* Essentials — mirrors oneuptime.com product grid */}
      <div className="mb-8">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Essentials</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { to: '/status-pages', label: 'Status Pages', desc: 'Public trust & uptime', Icon: IconGlobe },
            { to: '/incidents', label: 'Incidents', desc: 'Detect & resolve fast', Icon: IconAlertTriangle },
            { to: '/monitors', label: 'Monitoring', desc: 'Monitor any endpoint', Icon: IconActivity },
            { to: '/maintenance', label: 'Maintenance', desc: 'Plan downtime windows', Icon: IconCalendar },
          ].map(({ to, label, desc, Icon }) => (
            <Link key={to} to={to} className="feature-card group">
              <div className="w-9 h-9 rounded-lg bg-brand-50 flex items-center justify-center mb-3 group-hover:bg-brand-100 transition-colors">
                <Icon size={17} className="text-brand-600" />
              </div>
              <p className="text-sm font-semibold text-slate-900">{label}</p>
              <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* Bottom panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Recent monitors */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <IconMonitor size={15} className="text-brand-500" />
              <h3 className="section-title">Recent monitors</h3>
            </div>
            <Link to="/monitors" className="text-xs text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1 transition-colors">
              View all <IconArrowRight size={12} />
            </Link>
          </div>
          {monitorList.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center mb-3">
                <IconActivity size={18} className="text-brand-400" />
              </div>
              <p className="text-sm text-gray-400">No monitors configured</p>
            </div>
          ) : (
            <div className="space-y-1">
              {monitorList.slice(0, 6).map(m => (
                <Link
                  key={m.id}
                  to={`/monitors/${m.id}`}
                  className="flex items-center justify-between py-2.5 px-3 hover:bg-gray-50 rounded-lg transition-colors group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <StatusDot status={m.status} />
                    <span className="text-sm font-medium text-gray-800 truncate group-hover:text-brand-600 transition-colors">{m.name}</span>
                    <span className="text-xs text-gray-400 shrink-0 hidden sm:block capitalize">{m.type}</span>
                  </div>
                  <span className="text-xs text-gray-400 shrink-0 ml-2">{formatRelative(m.last_check_at)}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Recent incidents */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <IconZap size={15} className="text-amber-500" />
              <h3 className="section-title">Recent incidents</h3>
            </div>
            <Link to="/incidents" className="text-xs text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1 transition-colors">
              View all <IconArrowRight size={12} />
            </Link>
          </div>
          {incidentList.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center mb-3">
                <IconCheckCircle size={18} className="text-emerald-400" />
              </div>
              <p className="text-sm text-gray-400">No recent incidents</p>
            </div>
          ) : (
            <div className="space-y-1">
              {incidentList.slice(0, 5).map(inc => (
                <Link
                  key={inc.id}
                  to={`/incidents/${inc.id}`}
                  className="flex items-start justify-between py-2.5 px-3 hover:bg-gray-50 rounded-lg transition-colors group"
                >
                  <div className="flex-1 min-w-0 mr-3">
                    <p className="text-sm font-medium text-gray-800 truncate group-hover:text-brand-600 transition-colors">{inc.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{formatRelative(inc.created_at)}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {inc.severity_name && <Badge label={inc.severity_name} />}
                    {inc.state_name && <Badge label={inc.state_name} />}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Quick actions footer */}
      <div className="mt-6 flex flex-wrap gap-3">
        <Link to="/monitors" className="btn-secondary text-xs">
          <IconTrendingUp size={14} />
          Analyze performance
        </Link>
        <Link to="/status-pages" className="btn-secondary text-xs">
          <IconActivity size={14} />
          Status pages
        </Link>
      </div>
    </PageShell>
  )
}
