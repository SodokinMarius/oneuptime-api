import type { ComponentType } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { PageShell } from '@/components/ui/PageShell'

export function createProductLayout(options: {
  SideMenu: ComponentType
  hideMenuOnDetail?: RegExp
  wide?: boolean
}) {
  return function ProductRouteLayout() {
    const { pathname } = useLocation()
    const isDetail = options.hideMenuOnDetail?.test(pathname) ?? false
    const { SideMenu } = options

    return (
      <PageShell size={options.wide && !isDetail ? 'wide' : 'default'}>
        <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
          {!isDetail && <SideMenu />}
          <div className="flex-1 min-w-0">
            <Outlet />
          </div>
        </div>
      </PageShell>
    )
  }
}
