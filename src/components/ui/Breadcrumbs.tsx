import { Link } from 'react-router-dom'

export interface BreadcrumbItem {
  label: string
  to?: string
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[]
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className="mb-4">
      <ol className="flex flex-wrap items-center gap-1.5 text-sm text-slate-500">
        {items.map((item, index) => {
          const isLast = index === items.length - 1
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
  )
}
