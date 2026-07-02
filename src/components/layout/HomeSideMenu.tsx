import { Link, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { monitorsApi } from '@/api/monitors'
import { incidentsApi } from '@/api/incidents'
import { maintenanceApi } from '@/api/maintenance'
import {
  IconAlertTriangle,
  IconActivity,
  IconCalendar,
} from '@/components/ui/Icons'

interface SideMenuItem {
  to: string
  label: string
  count?: number
  badge?: 'danger' | 'warning'
}

interface SideMenuSection {
  title: string
  items: SideMenuItem[]
}

export default function HomeSideMenu() {
  const { pathname } = useLocation()

  const { data: monitors } = useQuery({
    queryKey: ['monitors', '', ''],
    queryFn: () => monitorsApi.list().then(r => r.data),
  })

  const { data: incidents } = useQuery({
    queryKey: ['incidents', ''],
    queryFn: () => incidentsApi.list({ page_size: '100' }).then(r => r.data),
  })

  const { data: maintenance } = useQuery({
    queryKey: ['maintenance', 'in_progress'],
    queryFn: () => maintenanceApi.list({ status: 'in_progress' }).then(r => r.data),
  })

  const monitorList = monitors?.results ?? []
  const incidentList = incidents?.results ?? []
  const maintenanceList = maintenance?.results ?? []

  const offlineCount = monitorList.filter(
    m => m.status === 'offline' || m.status === 'degraded'
  ).length

  const activeIncidents = incidentList.filter(
    i => !i.is_resolved && i.state_name !== 'resolved'
  ).length

  const sections: SideMenuSection[] = [
    {
      title: 'Incidents',
      items: [
        {
          to: '/dashboard/active-incidents',
          label: 'Active Incidents',
          count: activeIncidents,
          badge: activeIncidents > 0 ? 'danger' : undefined,
        },
      ],
    },
    {
      title: 'Monitors',
      items: [
        {
          to: '/dashboard/offline-monitors',
          label: 'Inoperational',
          count: offlineCount,
          badge: offlineCount > 0 ? 'danger' : undefined,
        },
      ],
    },
    {
      title: 'Scheduled Events',
      items: [
        {
          to: '/dashboard/ongoing-maintenance',
          label: 'Ongoing',
          count: maintenanceList.length,
          badge: maintenanceList.length > 0 ? 'warning' : undefined,
        },
      ],
    },
  ]

  return (
    <aside className="w-full lg:w-56 shrink-0">
      <nav className="space-y-5">
        {sections.map(section => (
          <div key={section.title}>
            <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              {section.title}
            </p>
            <div className="space-y-0.5">
              {section.items.map(item => {
                const active = pathname === item.to
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      active
                        ? 'bg-brand-50 text-brand-700'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      {section.title === 'Incidents' && <IconAlertTriangle size={15} />}
                      {section.title === 'Monitors' && <IconActivity size={15} />}
                      {section.title === 'Scheduled Events' && <IconCalendar size={15} />}
                      <span className="truncate">{item.label}</span>
                    </span>
                    {item.count !== undefined && item.count > 0 && (
                      <span
                        className={`shrink-0 min-w-[1.25rem] rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-center ${
                          item.badge === 'warning'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {item.count}
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  )
}
