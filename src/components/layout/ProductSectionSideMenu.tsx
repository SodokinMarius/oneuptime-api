import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { ResourceSideMenu } from '@/components/layout/DetailPageLayout'
import { isSideNavItemActive } from '@/components/layout/productMenu'

export interface SectionMenuItem {
  id: string
  label: string
  to: string
  end?: boolean
  icon?: ReactNode
  badge?: number
  badgeTone?: 'danger' | 'warning'
}

export interface SectionMenuSection {
  title: string
  items: SectionMenuItem[]
}

interface ProductSectionSideMenuProps {
  sections: SectionMenuSection[]
  currentView: string
  defaultView: string
  basePath: string
}

export function ProductSectionSideMenu({
  sections,
  currentView,
  defaultView,
  basePath,
}: ProductSectionSideMenuProps) {
  const location = useLocation()

  return (
    <ResourceSideMenu
      variant="detail"
      sections={sections.map(section => ({
        title: section.title,
        items: section.items.map(item => ({
          label: item.label,
          to: item.to,
          end: item.end,
          icon: item.icon,
          badge: item.badge,
          badgeTone: item.badgeTone,
          isActive: !item.to.startsWith(basePath)
            ? isSideNavItemActive({ label: item.label, to: item.to, end: item.end }, location)
            : item.id === defaultView
              ? currentView === defaultView && location.pathname === basePath
              : currentView === item.id,
        })),
      }))}
    />
  )
}
