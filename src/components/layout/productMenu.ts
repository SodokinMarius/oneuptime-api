import type { ComponentType } from 'react'
import type { Location } from 'react-router-dom'
import {
  IconActivity,
  IconGlobe,
  IconAlertTriangle,
  IconCalendar,
  IconBell,
  IconShieldCheck,
  IconUsers,
  IconSettings,
} from '@/components/ui/Icons'
import type { IconProps } from '@/components/ui/Icons'
import { hasPermission } from '@/utils/permissions'

export type ProductIcon = ComponentType<IconProps>

export interface ProductMenuItem {
  title: string
  description: string
  to: string
  pathPrefix: string
  Icon: ProductIcon
  iconBg: string
  iconColor: string
  category: string
  permission: string
}

export const PRODUCT_CATEGORIES = [
  'Essentials',
  'Platform',
  'Administration',
] as const

export const PRODUCT_MENU_ITEMS: ProductMenuItem[] = [
  {
    title: 'Monitoring',
    description: 'Monitor any endpoint',
    to: '/monitors',
    pathPrefix: '/monitors',
    Icon: IconActivity,
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-600',
    category: 'Essentials',
    permission: 'monitor:read',
  },
  {
    title: 'Status Pages',
    description: 'Public trust & uptime',
    to: '/status-pages',
    pathPrefix: '/status-pages',
    Icon: IconGlobe,
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
    category: 'Essentials',
    permission: 'status_page:read',
  },
  {
    title: 'Incidents',
    description: 'Detect & resolve fast',
    to: '/incidents',
    pathPrefix: '/incidents',
    Icon: IconAlertTriangle,
    iconBg: 'bg-rose-50',
    iconColor: 'text-rose-600',
    category: 'Essentials',
    permission: 'incident:read',
  },
  {
    title: 'Maintenance',
    description: 'Plan downtime windows',
    to: '/maintenance',
    pathPrefix: '/maintenance',
    Icon: IconCalendar,
    iconBg: 'bg-cyan-50',
    iconColor: 'text-cyan-600',
    category: 'Essentials',
    permission: 'scheduled_maintenance:read',
  },
  {
    title: 'Webhooks',
    description: 'Event notifications',
    to: '/webhooks',
    pathPrefix: '/webhooks',
    Icon: IconBell,
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-600',
    category: 'Platform',
    permission: 'webhook:read',
  },
  {
    title: 'Audit Log',
    description: 'Activity & compliance',
    to: '/audit',
    pathPrefix: '/audit',
    Icon: IconShieldCheck,
    iconBg: 'bg-violet-50',
    iconColor: 'text-violet-600',
    category: 'Platform',
    permission: 'audit_log:read',
  },
  {
    title: 'Users',
    description: 'Team members & invites',
    to: '/users',
    pathPrefix: '/users',
    Icon: IconUsers,
    iconBg: 'bg-slate-100',
    iconColor: 'text-slate-600',
    category: 'Administration',
    permission: 'user:read',
  },
  {
    title: 'Project Settings',
    description: 'Roles, SSO, API keys',
    to: '/settings',
    pathPrefix: '/settings',
    Icon: IconSettings,
    iconBg: 'bg-slate-100',
    iconColor: 'text-slate-600',
    category: 'Administration',
    permission: 'project:read',
  },
]

export function filterProductsByPermissions(permissions: string[]): ProductMenuItem[] {
  return PRODUCT_MENU_ITEMS.filter(item => hasPermission(permissions, item.permission))
}

export function findActiveProduct(pathname: string, permissions?: string[]): ProductMenuItem | undefined {
  if (pathname.startsWith('/dashboard')) return undefined
  const items = permissions ? filterProductsByPermissions(permissions) : PRODUCT_MENU_ITEMS
  return items.find(item => pathname.startsWith(item.pathPrefix))
}

export interface ProductSideNavItem {
  label: string
  to: string
  end?: boolean
  permission?: string | null
}

export interface ProductSideNavSection {
  title?: string
  items: ProductSideNavItem[]
}

const SETTINGS_SIDE_NAV: ProductSideNavSection[] = [
  {
    title: 'Account',
    items: [
      { label: 'Profile', to: '/settings', end: true, permission: null },
    ],
  },
  {
    title: 'Project',
    items: [
      { label: 'Projects', to: '/settings?tab=projects', permission: 'project:read' },
      { label: 'Roles', to: '/settings?tab=roles', permission: 'role:read' },
      { label: 'Teams', to: '/settings?tab=teams', permission: 'team:read' },
      { label: 'Policies', to: '/settings?tab=policies', permission: 'rbac:read' },
      { label: 'SSO', to: '/settings?tab=sso', permission: 'project:manage_sso' },
    ],
  },
  {
    title: 'Incidents',
    items: [
      { label: 'Escalation', to: '/settings?tab=escalation', permission: 'incident:read' },
      { label: 'Workflows', to: '/settings?tab=workflows', permission: 'incident:read' },
    ],
  },
  {
    title: 'Developers',
    items: [
      { label: 'API keys', to: '/settings?tab=apikeys', permission: 'api_key:read' },
    ],
  },
]

export const PRODUCT_SIDE_NAV: Record<string, ProductSideNavSection[]> = {
  '/monitors': [
    {
      title: 'Monitoring',
      items: [
        { label: 'All monitors', to: '/monitors' },
      ],
    },
  ],
  '/incidents': [
    {
      title: 'Incidents',
      items: [
        { label: 'All incidents', to: '/incidents' },
      ],
    },
  ],
  '/maintenance': [
    {
      title: 'Maintenance',
      items: [
        { label: 'Scheduled windows', to: '/maintenance', end: true },
      ],
    },
  ],
  '/status-pages': [
    {
      title: 'Status Pages',
      items: [
        { label: 'All pages', to: '/status-pages' },
      ],
    },
  ],
  '/webhooks': [
    {
      title: 'Webhooks',
      items: [
        { label: 'All webhooks', to: '/webhooks' },
      ],
    },
  ],
  '/audit': [
    {
      title: 'Audit Log',
      items: [
        { label: 'Log entries', to: '/audit', end: true },
      ],
    },
  ],
  '/users': [
    {
      title: 'Users',
      items: [
        { label: 'Team members', to: '/users', end: true },
      ],
    },
  ],
  '/settings': SETTINGS_SIDE_NAV,
}

export function getProductSideNav(
  pathPrefix: string,
  permissions: string[],
): ProductSideNavSection[] {
  const sections = PRODUCT_SIDE_NAV[pathPrefix] ?? []
  return sections
    .map(section => ({
      ...section,
      items: section.items.filter(
        item => !item.permission || hasPermission(permissions, item.permission),
      ),
    }))
    .filter(section => section.items.length > 0)
}

export function isSideNavItemActive(item: ProductSideNavItem, location: Location): boolean {
  const [path, queryPart] = item.to.split('?')
  const { pathname, search } = location

  if (pathname !== path) {
    if (!item.end && pathname.startsWith(`${path}/`)) return true
    return false
  }

  if (queryPart) {
    const expected = new URLSearchParams(queryPart)
    const actual = new URLSearchParams(search)
    for (const [key, value] of expected) {
      if (actual.get(key) !== value) return false
    }
    return true
  }

  if (item.end) {
    if (!search) return true
    if (path === '/settings' && search === '?tab=profile') return true
    return false
  }

  return true
}
