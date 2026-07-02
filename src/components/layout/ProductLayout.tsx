import { Outlet, useLocation } from 'react-router-dom'
import { PageShell } from '@/components/ui/PageShell'
import ProductSideMenu from '@/components/layout/ProductSideMenu'

export default function ProductLayout() {
  const { pathname } = useLocation()
  const wide = pathname.startsWith('/audit')
  const isResourceDetail = /^\/(monitors|incidents|status-pages|webhooks)\/[^/]+$/.test(pathname)

  return (
    <PageShell size={wide ? 'wide' : 'default'}>
      <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
        {!isResourceDetail && <ProductSideMenu />}
        <div className="flex-1 min-w-0">
          <Outlet />
        </div>
      </div>
    </PageShell>
  )
}
