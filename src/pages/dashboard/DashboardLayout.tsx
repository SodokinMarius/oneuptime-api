import { Outlet, Navigate } from 'react-router-dom'
import { PageShell } from '@/components/ui/PageShell'
import { Breadcrumbs } from '@/components/ui/Breadcrumbs'
import HomeSideMenu from '@/components/layout/HomeSideMenu'

export default function DashboardLayout() {
  return (
    <PageShell>
      <Breadcrumbs
        items={[
          { label: 'Project', to: '/dashboard' },
          { label: 'Home' },
        ]}
      />
      <h1 className="text-xl font-bold text-slate-900 tracking-tight mb-6">Home</h1>

      <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
        <HomeSideMenu />
        <div className="flex-1 min-w-0">
          <Outlet />
        </div>
      </div>
    </PageShell>
  )
}

export function DashboardIndexRedirect() {
  return <Navigate to="/dashboard/active-incidents" replace />
}
