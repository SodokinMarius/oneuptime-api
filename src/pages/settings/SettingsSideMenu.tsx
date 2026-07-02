import { useLocation } from 'react-router-dom'
import { ResourceSideMenu } from '@/components/layout/DetailPageLayout'
import { getProductSideNav, isSideNavItemActive } from '@/components/layout/productMenu'
import { usePermissions } from '@/hooks/usePermissions'
import {
  IconUser,
  IconFolder,
  IconShieldCheck,
  IconUsers,
  IconZap,
  IconSettings,
  IconLock,
} from '@/components/ui/Icons'

const TAB_ICONS: Record<string, React.ReactNode> = {
  '/settings': <IconUser />,
  '/settings?tab=projects': <IconFolder />,
  '/settings?tab=roles': <IconShieldCheck />,
  '/settings?tab=teams': <IconUsers />,
  '/settings?tab=policies': <IconLock />,
  '/settings?tab=sso': <IconSettings />,
  '/settings?tab=escalation': <IconZap />,
  '/settings?tab=workflows': <IconZap />,
  '/settings?tab=apikeys': <IconSettings />,
}

export default function SettingsSideMenu() {
  const location = useLocation()
  const { permissions } = usePermissions()
  const sections = getProductSideNav('/settings', permissions)

  return (
    <ResourceSideMenu
      variant="detail"
      sections={sections.map(section => ({
        title: section.title,
        items: section.items.map(item => ({
          label: item.label,
          to: item.to,
          end: item.end,
          icon: TAB_ICONS[item.to],
          isActive: isSideNavItemActive(item, location),
        })),
      }))}
    />
  )
}
