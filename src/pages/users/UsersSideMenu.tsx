import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { usersApi } from '@/api/users'
import { ProductSectionSideMenu } from '@/components/layout/ProductSectionSideMenu'
import { IconUsers, IconCheckCircle, IconPause, IconMail } from '@/components/ui/Icons'

export default function UsersSideMenu() {
  const [searchParams] = useSearchParams()
  const currentView = searchParams.get('view') || 'all'

  const { data } = useQuery({
    queryKey: ['users', 'side-menu-counts'],
    queryFn: () => usersApi.list().then(r => r.data),
  })

  const users = data?.results ?? []
  const pendingCount = users.filter(u => !u.is_email_verified).length
  const disabledCount = users.filter(u => !u.is_active).length

  return (
    <ProductSectionSideMenu
      basePath="/users"
      defaultView="all"
      currentView={currentView}
      sections={[
        {
          title: 'Users',
          items: [
            { id: 'all', label: 'All members', to: '/users', end: true, icon: <IconUsers /> },
          ],
        },
        {
          title: 'By status',
          items: [
            { id: 'active', label: 'Active', to: '/users?view=active', icon: <IconCheckCircle /> },
            {
              id: 'pending',
              label: 'Pending invite',
              to: '/users?view=pending',
              icon: <IconMail />,
              badge: pendingCount,
              badgeTone: 'warning',
            },
            { id: 'disabled', label: 'Disabled', to: '/users?view=disabled', icon: <IconPause />, badge: disabledCount },
          ],
        },
      ]}
    />
  )
}
