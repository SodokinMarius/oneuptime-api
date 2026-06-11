import { createBrowserRouter, Navigate } from 'react-router-dom'
import { authStore } from '@/store/auth'
import LoginPage from '@/pages/auth/LoginPage'
import RegisterPage from '@/pages/auth/RegisterPage'
import ActivatePage from '@/pages/auth/ActivatePage'
import SSOCallbackPage from '@/pages/auth/SSOCallbackPage'
import AppLayout from '@/components/layout/AppLayout'
import DashboardPage from '@/pages/dashboard/DashboardPage'
import MonitorsPage from '@/pages/monitors/MonitorsPage'
import MonitorDetailPage from '@/pages/monitors/MonitorDetailPage'
import IncidentsPage from '@/pages/incidents/IncidentsPage'
import IncidentDetailPage from '@/pages/incidents/IncidentDetailPage'
import MaintenancePage from '@/pages/maintenance/MaintenancePage'
import StatusPagesPage from '@/pages/status-pages/StatusPagesPage'
import StatusPageDetailPage from '@/pages/status-pages/StatusPageDetailPage'
import WebhooksPage from '@/pages/webhooks/WebhooksPage'
import WebhookDetailPage from '@/pages/webhooks/WebhookDetailPage'
import AuditPage from '@/pages/audit/AuditPage'
import UsersPage from '@/pages/users/UsersPage'
import SettingsPage from '@/pages/settings/SettingsPage'

function RequireAuth({ children }: { children: React.ReactNode }) {
  return authStore.isAuthenticated() ? <>{children}</> : <Navigate to="/login" replace />
}

function RedirectIfAuth({ children }: { children: React.ReactNode }) {
  return authStore.isAuthenticated() ? <Navigate to="/dashboard" replace /> : <>{children}</>
}

export const router = createBrowserRouter([
  { path: '/login',    element: <RedirectIfAuth><LoginPage /></RedirectIfAuth> },
  { path: '/register', element: <RedirectIfAuth><RegisterPage /></RedirectIfAuth> },
  { path: '/activate',     element: <RedirectIfAuth><ActivatePage /></RedirectIfAuth> },
  { path: '/sso/callback', element: <SSOCallbackPage /> },
  {
    path: '/',
    element: <RequireAuth><AppLayout /></RequireAuth>,
    children: [
      { index: true,                      element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard',                element: <DashboardPage /> },
      { path: 'monitors',                 element: <MonitorsPage /> },
      { path: 'monitors/:id',             element: <MonitorDetailPage /> },
      { path: 'incidents',                element: <IncidentsPage /> },
      { path: 'incidents/:id',            element: <IncidentDetailPage /> },
      { path: 'maintenance',              element: <MaintenancePage /> },
      { path: 'status-pages',             element: <StatusPagesPage /> },
      { path: 'status-pages/:id',         element: <StatusPageDetailPage /> },
      { path: 'webhooks',                 element: <WebhooksPage /> },
      { path: 'webhooks/:id',             element: <WebhookDetailPage /> },
      { path: 'audit',                    element: <AuditPage /> },
      { path: 'users',                    element: <UsersPage /> },
      { path: 'settings',                 element: <SettingsPage /> },
    ],
  },
  { path: '*', element: <Navigate to="/dashboard" replace /> },
])
