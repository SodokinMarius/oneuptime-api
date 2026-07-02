import type { ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'

export interface SideMenuItem {
  to: string
  label: string
  end?: boolean
  badge?: number
  badgeTone?: 'danger' | 'warning'
  isActive?: boolean
  icon?: ReactNode
}

export interface SideMenuSection {
  title?: string
  items: SideMenuItem[]
}

interface ResourceSideMenuProps {
  sections: SideMenuSection[]
  variant?: 'default' | 'detail'
}

export function ResourceSideMenu({ sections, variant = 'default' }: ResourceSideMenuProps) {
  const isDetail = variant === 'detail'

  return (
    <aside className={`w-full shrink-0 ${isDetail ? 'lg:w-60' : 'lg:w-56'}`}>
      <nav className="space-y-5">
        {sections.map((section, idx) => (
          <div key={section.title ?? `section-${idx}`}>
            {section.title && (
              <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                {section.title}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => {
                    const active = item.isActive ?? isActive
                    return `flex items-center justify-between gap-2 rounded-lg py-2 pr-3 text-sm font-medium transition-colors border-l-2 ${
                      active
                        ? 'bg-brand-50 text-brand-700 border-brand-600 pl-[10px]'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border-transparent pl-3'
                    }`
                  }}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    {item.icon && (
                      <span className="shrink-0 text-slate-400 [&_svg]:size-[15px]">
                        {item.icon}
                      </span>
                    )}
                    <span className="truncate">{item.label}</span>
                  </span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span
                      className={`shrink-0 min-w-[1.25rem] rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-center ${
                        item.badgeTone === 'warning'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  )
}

interface DetailPageLayoutProps {
  breadcrumbs: { label: string; to?: string }[]
  title: ReactNode
  subtitle?: ReactNode
  badges?: ReactNode
  actions?: ReactNode
  sideMenu?: ReactNode
  children: ReactNode
  embedded?: boolean
}

export function DetailPageLayout({
  breadcrumbs,
  title,
  subtitle,
  badges,
  actions,
  sideMenu,
  children,
  embedded = false,
}: DetailPageLayoutProps) {
  const content = (
    <>
      <nav aria-label="Breadcrumb" className="mb-4">
        <ol className="flex flex-wrap items-center gap-1.5 text-sm text-slate-500">
          {breadcrumbs.map((item, index) => {
            const isLast = index === breadcrumbs.length - 1
            return (
              <li key={`${item.label}-${index}`} className="flex items-center gap-1.5">
                {index > 0 && <span className="text-slate-300">/</span>}
                {item.to && !isLast ? (
                  <Link to={item.to} className="hover:text-brand-600 transition-colors">
                    {item.label}
                  </Link>
                ) : (
                  <span className={isLast ? 'font-medium text-slate-900' : ''}>{item.label}</span>
                )}
              </li>
            )
          })}
        </ol>
      </nav>

      <div className="detail-header">
        <div className="min-w-0">
          <h1 className="page-header">{title}</h1>
          {subtitle && <div className="page-subtext mt-1">{subtitle}</div>}
          {badges && <div className="flex flex-wrap items-center gap-2 mt-3">{badges}</div>}
        </div>
        {actions && <div className="flex flex-wrap gap-2 w-full sm:w-auto">{actions}</div>}
      </div>

      <div className={`flex flex-col gap-6 ${sideMenu ? 'lg:flex-row lg:gap-8' : ''}`}>
        {sideMenu}
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </>
  )

  if (embedded) return <div>{content}</div>

  return <div className="page-shell">{content}</div>
}
