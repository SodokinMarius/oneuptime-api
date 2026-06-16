import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  subtitle?: string
  actions?: ReactNode
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="page-header-row">
      <div className="min-w-0">
        <h2 className="page-header">{title}</h2>
        {subtitle && <p className="page-subtext">{subtitle}</p>}
      </div>
      {actions && (
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto shrink-0">
          {actions}
        </div>
      )}
    </div>
  )
}
