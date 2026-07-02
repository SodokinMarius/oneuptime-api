import { useState, useEffect, useRef } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { authStore } from '@/store/auth'
import { authApi } from '@/api/auth'
import ProjectSwitcher from '@/components/layout/ProjectSwitcher'
import {
  IconLayoutDashboard,
  IconActivity,
  IconAlertTriangle,
  IconWrench,
  IconGlobe,
  IconBell,
  IconShieldCheck,
  IconUsers,
  IconSettings,
  IconLogOut,
  IconMenu,
  IconX,
  IconChevronLeft,
  IconChevronRight,
  IconZap,
} from '@/components/ui/Icons'

type NavItem = { to: string; label: string; Icon: typeof IconActivity }

const navSections: { title: string; items: NavItem[] }[] = [
  {
    title: 'Overview',
    items: [
      { to: '/dashboard', label: 'Dashboard', Icon: IconLayoutDashboard },
    ],
  },
  {
    title: 'Essentials',
    items: [
      { to: '/monitors', label: 'Monitoring', Icon: IconActivity },
      { to: '/incidents', label: 'Incidents', Icon: IconAlertTriangle },
      { to: '/status-pages', label: 'Status Pages', Icon: IconGlobe },
      { to: '/maintenance', label: 'Maintenance', Icon: IconWrench },
    ],
  },
  {
    title: 'Platform',
    items: [
      { to: '/webhooks', label: 'Webhooks', Icon: IconBell },
      { to: '/audit', label: 'Audit Log', Icon: IconShieldCheck },
    ],
  },
  {
    title: 'Administration',
    items: [
      { to: '/users', label: 'Users', Icon: IconUsers },
      { to: '/settings', label: 'Settings', Icon: IconSettings },
    ],
  },
]

export default function AppLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const user = authStore.getUser()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [desktopCollapsed, setDesktopCollapsed] = useState(false)
  const sidebarRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setSidebarOpen(false) }, [location.pathname])

  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (sidebarOpen && sidebarRef.current && !sidebarRef.current.contains(e.target as Node)) {
        setSidebarOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [sidebarOpen])

  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [sidebarOpen])

  const handleLogout = async () => {
    const refresh = authStore.getRefreshToken()
    if (refresh) {
      try { await authApi.logout(refresh) } catch { /* ignore */ }
    }
    authStore.clear()
    navigate('/login')
  }

  const userInitials = [user?.first_name?.[0], user?.last_name?.[0]].filter(Boolean).join('').toUpperCase() || '?'

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className={`px-4 py-5 flex items-center shrink-0 ${desktopCollapsed ? 'justify-center' : 'justify-between'}`}>
        {!desktopCollapsed && (
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center shadow-sm shadow-brand-600/20">
              <IconZap size={16} className="text-white" strokeWidth={2.5} />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900 leading-none tracking-tight">OneUptime</p>
              <p className="text-[10px] text-slate-500 mt-0.5">Observability Platform</p>
            </div>
          </div>
        )}
        {desktopCollapsed && (
          <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center shadow-sm">
            <IconZap size={16} className="text-white" strokeWidth={2.5} />
          </div>
        )}
        <button
          onClick={() => setDesktopCollapsed(!desktopCollapsed)}
          className="hidden lg:flex items-center justify-center w-7 h-7 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
          title={desktopCollapsed ? 'Expand' : 'Collapse'}
        >
          {desktopCollapsed
            ? <IconChevronRight size={15} />
            : <IconChevronLeft size={15} />
          }
        </button>
      </div>

      <div className="mx-4 h-px bg-slate-200 mb-2 shrink-0" />

      <ProjectSwitcher collapsed={desktopCollapsed} />

      {/* Grouped navigation — mirrors oneuptime.com product sections */}
      <nav className="flex-1 px-2.5 overflow-y-auto py-1">
        {navSections.map((section) => (
          <div key={section.title} className="mb-1">
            {!desktopCollapsed && (
              <p className="sidebar-section-label">{section.title}</p>
            )}
            <div className="space-y-0.5">
              {section.items.map(({ to, label, Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  title={desktopCollapsed ? label : undefined}
                  className={({ isActive }) =>
                    `sidebar-item ${isActive ? 'sidebar-item-active' : 'sidebar-item-inactive'} ${desktopCollapsed ? 'justify-center px-2' : ''}`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon
                        size={17}
                        className={isActive ? 'text-brand-600' : 'text-slate-400'}
                        strokeWidth={isActive ? 2 : 1.75}
                      />
                      {!desktopCollapsed && <span className="truncate">{label}</span>}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* User */}
      <div className="px-2.5 py-3 mt-auto shrink-0 border-t border-slate-200">
        {!desktopCollapsed ? (
          <div className="flex items-center gap-2.5 px-2 mb-2 pt-2">
            <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-xs font-semibold text-brand-700 shrink-0 ring-2 ring-brand-50">
              {userInitials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 truncate leading-none">
                {user?.first_name} {user?.last_name}
              </p>
              <p className="text-xs text-slate-500 truncate mt-0.5">{user?.email}</p>
            </div>
          </div>
        ) : (
          <div className="flex justify-center mb-2 pt-2">
            <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-xs font-semibold text-brand-700">
              {userInitials}
            </div>
          </div>
        )}
        <button
          onClick={handleLogout}
          title="Sign out"
          className={`w-full sidebar-item sidebar-item-inactive text-slate-500 hover:text-red-600 hover:bg-red-50 ${desktopCollapsed ? 'justify-center px-2' : ''}`}
        >
          <IconLogOut size={16} />
          {!desktopCollapsed && <span>Sign out</span>}
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen bg-slate-50">

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm lg:hidden"
          aria-hidden="true"
        />
      )}

      <aside
        ref={sidebarRef}
        className={`
          fixed inset-y-0 left-0 z-40 w-64
          bg-white text-slate-900 flex flex-col
          transform transition-transform duration-300 ease-in-out
          lg:hidden border-r border-slate-200 shadow-xl
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <button
          onClick={() => setSidebarOpen(false)}
          className="absolute top-4 right-3.5 text-slate-400 hover:text-slate-700 p-1.5 rounded-md hover:bg-slate-100 transition-colors"
          aria-label="Close"
        >
          <IconX size={16} />
        </button>
        <SidebarContent />
      </aside>

      <aside
        className={`
          hidden lg:flex flex-col
          bg-white text-slate-900 shrink-0
          transition-all duration-300 ease-in-out
          border-r border-slate-200
          ${desktopCollapsed ? 'w-[60px]' : 'w-60'}
        `}
      >
        <SidebarContent />
      </aside>

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-slate-200 shrink-0 z-20">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
            aria-label="Menu"
          >
            <IconMenu size={18} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-brand-600 flex items-center justify-center">
              <IconZap size={12} className="text-white" strokeWidth={2.5} />
            </div>
            <span className="font-bold text-slate-900 text-sm">OneUptime</span>
          </div>
          <div className="ml-auto">
            <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-xs font-semibold text-brand-700">
              {userInitials}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto overscroll-contain bg-slate-50">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
