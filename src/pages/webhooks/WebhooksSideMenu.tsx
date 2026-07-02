import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { webhooksApi } from '@/api/webhooks'
import { ProductSectionSideMenu } from '@/components/layout/ProductSectionSideMenu'
import { IconBell, IconCheckCircle, IconPause } from '@/components/ui/Icons'

export default function WebhooksSideMenu() {
  const [searchParams] = useSearchParams()
  const currentView = searchParams.get('view') || 'all'

  const { data } = useQuery({
    queryKey: ['webhooks', 'side-menu-counts'],
    queryFn: () => webhooksApi.list({ page_size: '200' }).then(r => r.data),
  })

  const webhooks = data?.results ?? []
  const inactiveCount = webhooks.filter(w => !w.is_active).length

  return (
    <ProductSectionSideMenu
      basePath="/webhooks"
      defaultView="all"
      currentView={currentView}
      sections={[
        {
          title: 'Webhooks',
          items: [
            { id: 'all', label: 'All webhooks', to: '/webhooks', end: true, icon: <IconBell /> },
          ],
        },
        {
          title: 'Status',
          items: [
            { id: 'active', label: 'Active', to: '/webhooks?view=active', icon: <IconCheckCircle /> },
            {
              id: 'inactive',
              label: 'Inactive',
              to: '/webhooks?view=inactive',
              icon: <IconPause />,
              badge: inactiveCount,
            },
          ],
        },
      ]}
    />
  )
}
