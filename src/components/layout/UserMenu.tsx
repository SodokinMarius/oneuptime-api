import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authStore } from '@/store/auth'
import { authApi } from '@/api/auth'
import { IconChevronDown, IconLogOut, IconSettings, IconUser } from '@/components/ui/Icons'

export default function UserMenu() {
  const navigate = useNavigate()
  const user = authStore.getUser()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const initials = [user?.first_name?.[0], user?.last_name?.[0]].filter(Boolean).join('').toUpperCase() || '?'

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

  const handleLogout = async () => {
    const refresh = authStore.getRefreshToken()
    if (refresh) {
      try { await authApi.logout(refresh) } catch { /* ignore */ }
    }
    authStore.clear()
    navigate('/login')
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 rounded-lg py-1.5 pl-1.5 pr-2 hover:bg-slate-50 transition-colors"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
          {initials}
        </div>
        <span className="hidden md:block text-sm font-medium text-slate-700 max-w-[120px] truncate">
          {user?.first_name}
        </span>
        <IconChevronDown size={14} className="hidden md:block text-slate-400" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-56 rounded-lg border border-slate-200 bg-white py-1 shadow-xl">
          <div className="px-3 py-2 border-b border-slate-100">
            <p className="text-sm font-medium text-slate-900 truncate">
              {user?.first_name} {user?.last_name}
            </p>
            <p className="text-xs text-slate-500 truncate">{user?.email}</p>
          </div>
          <Link
            to="/settings?tab=profile"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            <IconUser size={15} />
            Profile
          </Link>
          <Link
            to="/settings"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            <IconSettings size={15} />
            Settings
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
          >
            <IconLogOut size={15} />
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}
