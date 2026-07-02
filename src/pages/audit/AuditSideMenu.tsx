import { useSearchParams } from 'react-router-dom'
import { ProductSectionSideMenu } from '@/components/layout/ProductSectionSideMenu'
import {
  IconShieldCheck,
  IconAlertTriangle,
  IconActivity,
  IconBell,
  IconUsers,
  IconSettings,
} from '@/components/ui/Icons'

const RESOURCE_VIEWS = [
  { id: 'incident', label: 'Incidents', icon: <IconAlertTriangle /> },
  { id: 'monitor', label: 'Monitors', icon: <IconActivity /> },
  { id: 'webhook', label: 'Webhooks', icon: <IconBell /> },
  { id: 'user', label: 'Users', icon: <IconUsers /> },
  { id: 'api_key', label: 'API keys', icon: <IconSettings /> },
] as const

export default function AuditSideMenu() {
  const [searchParams] = useSearchParams()
  const currentView = searchParams.get('view') || 'all'

  return (
    <ProductSectionSideMenu
      basePath="/audit"
      defaultView="all"
      currentView={currentView}
      sections={[
        {
          title: 'Audit Log',
          items: [
            { id: 'all', label: 'All entries', to: '/audit', end: true, icon: <IconShieldCheck /> },
          ],
        },
        {
          title: 'By resource',
          items: RESOURCE_VIEWS.map(item => ({
            id: item.id,
            label: item.label,
            to: `/audit?view=${item.id}`,
            icon: item.icon,
          })),
        },
      ]}
    />
  )
}
