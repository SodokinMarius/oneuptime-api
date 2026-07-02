import type { ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ResourceSideMenu, type SideMenuItem } from '@/components/layout/DetailPageLayout'

export interface DetailSectionMenuItem {
  id: string
  label: string
  icon?: ReactNode
  badge?: number
  badgeTone?: 'danger' | 'warning'
}

export interface DetailSectionMenuSection {
  title: string
  items: DetailSectionMenuItem[]
}

interface DetailSectionMenuProps {
  sections: DetailSectionMenuSection[]
  basePath: string
  defaultView?: string
}

export function DetailSectionMenu({
  sections,
  basePath,
  defaultView = 'overview',
}: DetailSectionMenuProps) {
  const [searchParams] = useSearchParams()
  const currentView = searchParams.get('view') || defaultView

  const menuSections = sections.map(section => ({
    title: section.title,
    items: section.items.map(item => ({
      label: item.label,
      icon: item.icon,
      badge: item.badge,
      badgeTone: item.badgeTone,
      to: item.id === defaultView ? basePath : `${basePath}?view=${item.id}`,
      end: item.id === defaultView,
      isActive: currentView === item.id,
    })) satisfies SideMenuItem[],
  }))

  return <ResourceSideMenu sections={menuSections} variant="detail" />
}
