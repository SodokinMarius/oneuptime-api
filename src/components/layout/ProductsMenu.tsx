import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { IconChevronDown, IconGrid } from '@/components/ui/Icons'
import { PRODUCT_CATEGORIES, filterProductsByPermissions, type ProductMenuItem } from './productMenu'
import { usePermissions } from '@/hooks/usePermissions'

interface ProductsMenuProps {
  activeProduct?: ProductMenuItem
  onNavigate?: () => void
}

export default function ProductsMenu({ activeProduct, onNavigate }: ProductsMenuProps) {
  const { permissions } = usePermissions()
  const visibleProducts = filterProductsByPermissions(permissions)
  const visibleCategories = PRODUCT_CATEGORIES.filter(cat =>
    visibleProducts.some(item => item.category === cat)
  )
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const show = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    setOpen(true)
  }

  const hide = () => {
    closeTimer.current = setTimeout(() => setOpen(false), 120)
  }

  useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const triggerClass = activeProduct
    ? 'bg-slate-100 text-slate-900 hover:bg-slate-200'
    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'

  return (
    <div
      ref={containerRef}
      className="relative"
      onMouseEnter={show}
      onMouseLeave={hide}
    >
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`inline-flex items-center gap-1.5 rounded-md py-2 px-3 text-sm font-medium transition-colors ${triggerClass}`}
      >
        {activeProduct ? (
          <>
            <activeProduct.Icon size={16} className={activeProduct.iconColor} />
            <span>{activeProduct.title}</span>
          </>
        ) : (
          <>
            <IconGrid size={16} className="text-slate-400" />
            <span>Products</span>
          </>
        )}
        <IconChevronDown size={14} className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          className="absolute left-0 top-full z-50 mt-1 w-[min(92vw,720px)] rounded-xl border border-slate-200 bg-white p-4 shadow-xl"
          onMouseEnter={show}
          onMouseLeave={hide}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {visibleCategories.map(category => {
              const items = visibleProducts.filter(i => i.category === category)
              if (!items.length) return null
              return (
                <div key={category}>
                  <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    {category}
                  </p>
                  <div className="space-y-0.5">
                    {items.map(item => (
                      <Link
                        key={item.to}
                        to={item.to}
                        onClick={() => {
                          setOpen(false)
                          onNavigate?.()
                        }}
                        className="flex items-start gap-3 rounded-lg p-2 hover:bg-slate-50 transition-colors group"
                      >
                        <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${item.iconBg}`}>
                          <item.Icon size={17} className={item.iconColor} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900 group-hover:text-brand-600 transition-colors">
                            {item.title}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5 leading-snug">{item.description}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
