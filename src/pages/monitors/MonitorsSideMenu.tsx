import { useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { monitorsApi } from '@/api/monitors'
import { ResourceSideMenu } from '@/components/layout/DetailPageLayout'
import {
  IconMonitor,
  IconAlertTriangle,
  IconPause,
  IconSettings,
} from '@/components/ui/Icons'

type MonitorView = 'all' | 'non-operational' | 'disabled'

interface MonitorMenuItem {
  id: MonitorView | 'settings'
  label: string
  to: string
  end?: boolean
}

const MENU_SECTIONS: { title: string; items: MonitorMenuItem[] }[] = [
  {
    title: 'Monitors',
    items: [
      { id: 'all', label: 'All monitors', to: '/monitors', end: true },
    ],
  },
  {
    title: 'Attention Required',
    items: [
      { id: 'non-operational', label: 'Non-operational', to: '/monitors?view=non-operational' },
      { id: 'disabled', label: 'Disabled', to: '/monitors?view=disabled' },
    ],
  },
  {
    title: 'Settings',
    items: [
      { id: 'settings', label: 'Project settings', to: '/settings' },
    ],
  },
]

export default function MonitorsSideMenu() {
  const location = useLocation()
  const currentView = (new URLSearchParams(location.search).get('view') || 'all') as MonitorView

  const { data } = useQuery({
    queryKey: ['monitors', 'side-menu-counts'],
    queryFn: () => monitorsApi.list({ page_size: '200' }).then(r => r.data),
  })

  const monitors = data?.results ?? []
  const nonOperationalCount = monitors.filter(
    m => m.status === 'offline' || m.status === 'degraded',
  ).length
  const disabledCount = monitors.filter(m => m.is_paused || m.status === 'disabled').length

  const badges: Partial<Record<MonitorView, number>> = {
    'non-operational': nonOperationalCount,
    disabled: disabledCount,
  }

  return (
    <ResourceSideMenu
      variant="detail"
      sections={MENU_SECTIONS.map(section => ({
        title: section.title,
        items: section.items.map(item => ({
          label: item.label,
          to: item.to,
          end: item.end,
          isActive: item.id === 'settings'
            ? false
            : item.id === 'all'
              ? currentView === 'all' && location.pathname === '/monitors'
              : currentView === item.id,
          badge: item.id in badges ? badges[item.id as MonitorView] : undefined,
          badgeTone: item.id === 'non-operational' && badges['non-operational'] ? 'danger' as const : undefined,
          icon: item.id === 'all' ? <IconMonitor /> :
            item.id === 'non-operational' ? <IconAlertTriangle /> :
            item.id === 'disabled' ? <IconPause /> :
            <IconSettings />,
        })),
      }))}
    />
  )
}
