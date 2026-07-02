import { Link, useLocation } from 'react-router-dom'
import { IconHome } from '@/components/ui/Icons'
import { findActiveProduct } from './productMenu'
import { usePermissions } from '@/hooks/usePermissions'
import ProductsMenu from './ProductsMenu'

interface TopNavProps {
  onNavigate?: () => void
}

export default function TopNav({ onNavigate }: TopNavProps) {
  const { pathname } = useLocation()
  const { permissions } = usePermissions()
  const isHome = pathname.startsWith('/dashboard')
  const activeProduct = findActiveProduct(pathname, permissions)

  return (
    <nav className="flex items-center gap-1 text-sm">
      <Link
        to="/dashboard"
        onClick={onNavigate}
        className={`inline-flex items-center gap-1.5 rounded-md py-2 px-3 font-medium transition-colors ${
          isHome
            ? 'bg-brand-50 text-brand-700'
            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
        }`}
      >
        <IconHome size={16} />
        <span>Home</span>
      </Link>

      <span className="text-slate-300 mx-0.5">/</span>

      <ProductsMenu activeProduct={activeProduct} onNavigate={onNavigate} />
    </nav>
  )
}
