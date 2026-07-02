import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Link } from 'react-router-dom'
import ProjectSwitcher from '@/components/layout/ProjectSwitcher'
import TopNav from '@/components/layout/TopNav'
import UserMenu from '@/components/layout/UserMenu'
import { IconMenu, IconX, IconZap } from '@/components/ui/Icons'

export default function AppLayout() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  return (
    <div className="flex h-screen flex-col bg-slate-50">
      <header className="shrink-0 z-30 bg-white border-b border-slate-200 shadow-sm">
        <div className="flex h-14 items-center gap-3 px-3 sm:px-4">
          {/* Logo + project */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen(o => !o)}
              className="lg:hidden p-2 rounded-lg text-slate-500 hover:bg-slate-100"
              aria-label="Toggle navigation"
            >
              {mobileNavOpen ? <IconX size={18} /> : <IconMenu size={18} />}
            </button>

            <Link to="/dashboard" className="flex items-center gap-2 shrink-0">
              <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center shadow-sm">
                <IconZap size={16} className="text-white" strokeWidth={2.5} />
              </div>
              <span className="hidden sm:block text-sm font-bold text-slate-900 tracking-tight">
                OneUptime
              </span>
            </Link>

            <div className="hidden sm:block h-6 w-px bg-slate-200" />

            <ProjectSwitcher variant="header" />
          </div>

          {/* Center nav — desktop */}
          <div className="hidden lg:flex flex-1 justify-center min-w-0">
            <TopNav />
          </div>

          <div className="ml-auto flex items-center gap-2">
            <UserMenu />
          </div>
        </div>

        {/* Mobile nav drawer */}
        {mobileNavOpen && (
          <div className="lg:hidden border-t border-slate-100 bg-white px-3 py-3">
            <TopNav onNavigate={() => setMobileNavOpen(false)} />
          </div>
        )}
      </header>

      <main className="flex-1 overflow-auto overscroll-contain">
        <Outlet />
      </main>
    </div>
  )
}
