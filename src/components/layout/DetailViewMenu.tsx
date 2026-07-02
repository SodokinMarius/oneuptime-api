import { ResourceSideMenu, type SideMenuItem } from '@/components/layout/DetailPageLayout'

interface DetailViewMenuProps {
  sectionTitle?: string
  items: { id: string; label: string; badge?: number; badgeTone?: 'danger' | 'warning' }[]
  basePath: string
  defaultView?: string
}

export function DetailViewMenu({
  sectionTitle = 'Details',
  items,
  basePath,
  defaultView = 'overview',
}: DetailViewMenuProps) {
  const menuItems: SideMenuItem[] = items.map(item => ({
    label: item.label,
    badge: item.badge,
    badgeTone: item.badgeTone,
    to: item.id === defaultView ? basePath : `${basePath}?view=${item.id}`,
    end: item.id === defaultView,
  }))

  return <ResourceSideMenu sections={[{ title: sectionTitle, items: menuItems }]} />
}
