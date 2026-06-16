import type { ReactNode } from 'react'

type PageShellSize = 'default' | 'wide' | 'narrow'

const sizeClass: Record<PageShellSize, string> = {
  default: 'page-shell',
  wide: 'page-shell-wide',
  narrow: 'page-shell-narrow',
}

interface PageShellProps {
  children: ReactNode
  size?: PageShellSize
  className?: string
}

export function PageShell({ children, size = 'default', className = '' }: PageShellProps) {
  return <div className={`${sizeClass[size]} ${className}`.trim()}>{children}</div>
}
