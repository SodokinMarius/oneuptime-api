import type { ReactNode } from 'react'
import { Breadcrumbs, type BreadcrumbItem } from '@/components/ui/Breadcrumbs'
import { PageShell } from '@/components/ui/PageShell'
import { PageHeader } from '@/components/ui/PageHeader'

interface ListPageLayoutProps {
  breadcrumbs: BreadcrumbItem[]
  title: string
  subtitle?: string
  actions?: ReactNode
  children: ReactNode
  size?: 'default' | 'wide' | 'narrow'
  embedded?: boolean
}

export function ListPageLayout({
  breadcrumbs,
  title,
  subtitle,
  actions,
  children,
  size = 'default',
  embedded = false,
}: ListPageLayoutProps) {
  const content = (
    <>
      <Breadcrumbs items={breadcrumbs} />
      <PageHeader title={title} subtitle={subtitle} actions={actions} />
      {children}
    </>
  )

  if (embedded) return <div>{content}</div>

  return (
    <PageShell size={size}>
      {content}
    </PageShell>
  )
}
