import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { statusPagesApi } from '@/api/statusPages'
import { ProductSectionSideMenu } from '@/components/layout/ProductSectionSideMenu'
import { IconGlobe, IconLock, IconWifi } from '@/components/ui/Icons'

export default function StatusPagesSideMenu() {
  const [searchParams] = useSearchParams()
  const currentView = searchParams.get('view') || 'all'

  const { data } = useQuery({
    queryKey: ['status-pages', 'side-menu-counts'],
    queryFn: () => statusPagesApi.list({ page_size: '200' }).then(r => r.data),
  })

  const pages = data?.results ?? []
  const publicCount = pages.filter(p => p.is_public).length
  const privateCount = pages.filter(p => !p.is_public).length

  return (
    <ProductSectionSideMenu
      basePath="/status-pages"
      defaultView="all"
      currentView={currentView}
      sections={[
        {
          title: 'Status Pages',
          items: [
            { id: 'all', label: 'All pages', to: '/status-pages', end: true, icon: <IconGlobe /> },
          ],
        },
        {
          title: 'Visibility',
          items: [
            { id: 'public', label: 'Public pages', to: '/status-pages?view=public', icon: <IconWifi />, badge: publicCount },
            { id: 'private', label: 'Private pages', to: '/status-pages?view=private', icon: <IconLock />, badge: privateCount },
          ],
        },
      ]}
    />
  )
}
