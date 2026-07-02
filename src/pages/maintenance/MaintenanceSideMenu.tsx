import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { maintenanceApi } from '@/api/maintenance'
import { ProductSectionSideMenu } from '@/components/layout/ProductSectionSideMenu'
import {
  IconCalendar,
  IconClock,
  IconCheckCircle,
  IconX,
} from '@/components/ui/Icons'

export default function MaintenanceSideMenu() {
  const [searchParams] = useSearchParams()
  const currentView = searchParams.get('view') || 'all'

  const { data } = useQuery({
    queryKey: ['maintenance', 'side-menu-counts'],
    queryFn: () => maintenanceApi.list({ page_size: '200' }).then(r => r.data),
  })

  const items = data?.results ?? []
  const inProgressCount = items.filter(m => m.status === 'in_progress').length

  return (
    <ProductSectionSideMenu
      basePath="/maintenance"
      defaultView="all"
      currentView={currentView}
      sections={[
        {
          title: 'Maintenance',
          items: [
            { id: 'all', label: 'All windows', to: '/maintenance', end: true, icon: <IconCalendar /> },
          ],
        },
        {
          title: 'By status',
          items: [
            { id: 'scheduled', label: 'Scheduled', to: '/maintenance?view=scheduled', icon: <IconClock /> },
            {
              id: 'in_progress',
              label: 'In progress',
              to: '/maintenance?view=in_progress',
              icon: <IconCalendar />,
              badge: inProgressCount,
              badgeTone: 'warning',
            },
            { id: 'completed', label: 'Completed', to: '/maintenance?view=completed', icon: <IconCheckCircle /> },
            { id: 'cancelled', label: 'Cancelled', to: '/maintenance?view=cancelled', icon: <IconX /> },
          ],
        },
      ]}
    />
  )
}
