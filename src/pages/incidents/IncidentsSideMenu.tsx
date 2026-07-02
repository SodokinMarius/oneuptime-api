import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { incidentsApi } from '@/api/incidents'
import { ProductSectionSideMenu } from '@/components/layout/ProductSectionSideMenu'
import { usePermissions } from '@/hooks/usePermissions'
import { hasPermission } from '@/utils/permissions'
import {
  IconAlertTriangle,
  IconCheckCircle,
  IconSettings,
  IconZap,
} from '@/components/ui/Icons'

export default function IncidentsSideMenu() {
  const [searchParams] = useSearchParams()
  const { permissions } = usePermissions()
  const currentView = searchParams.get('view') || 'all'

  const { data } = useQuery({
    queryKey: ['incidents', 'side-menu-counts'],
    queryFn: () => incidentsApi.list({ page_size: '200' }).then(r => r.data),
  })

  const incidents = data?.results ?? []
  const activeCount = incidents.filter(i => !i.is_resolved && i.state_name !== 'resolved').length

  const sections = [
    {
      title: 'Incidents',
      items: [
        { id: 'all', label: 'All incidents', to: '/incidents', end: true, icon: <IconAlertTriangle /> },
      ],
    },
    {
      title: 'Attention Required',
      items: [
        {
          id: 'active',
          label: 'Active incidents',
          to: '/incidents?view=active',
          icon: <IconZap />,
          badge: activeCount,
          badgeTone: 'danger' as const,
        },
      ],
    },
    {
      title: 'History',
      items: [
        { id: 'resolved', label: 'Resolved', to: '/incidents?view=resolved', icon: <IconCheckCircle /> },
      ],
    },
  ]

  if (hasPermission(permissions, 'incident:read')) {
    sections.push({
      title: 'Settings',
      items: [
        { id: 'escalation', label: 'Escalation', to: '/settings?tab=escalation', icon: <IconSettings /> },
        { id: 'workflows', label: 'Workflows', to: '/settings?tab=workflows', icon: <IconSettings /> },
      ],
    })
  }

  return (
    <ProductSectionSideMenu
      basePath="/incidents"
      defaultView="all"
      currentView={currentView}
      sections={sections}
    />
  )
}
