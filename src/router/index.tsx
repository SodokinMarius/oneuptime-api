import { createBrowserRouter, Navigate } from 'react-router-dom'
import { authStore } from '@/store/auth'
import LoginPage from '@/pages/auth/LoginPage'
import RegisterPage from '@/pages/auth/RegisterPage'
import ActivatePage from '@/pages/auth/ActivatePage'
import AcceptInvitePage from '@/pages/auth/AcceptInvitePage'
import SSOCallbackPage from '@/pages/auth/SSOCallbackPage'
import AppLayout from '@/components/layout/AppLayout'
import MonitorsLayout from '@/pages/monitors/MonitorsLayout'
import IncidentsLayout from '@/pages/incidents/IncidentsLayout'
import MaintenanceLayout from '@/pages/maintenance/MaintenanceLayout'
import StatusPagesLayout from '@/pages/status-pages/StatusPagesLayout'
import WebhooksLayout from '@/pages/webhooks/WebhooksLayout'
import AuditLayout from '@/pages/audit/AuditLayout'
import UsersLayout from '@/pages/users/UsersLayout'
import SettingsLayout from '@/pages/settings/SettingsLayout'
import DashboardLayout, { DashboardIndexRedirect } from '@/pages/dashboard/DashboardLayout'
import ActiveIncidentsView from '@/pages/dashboard/ActiveIncidentsView'
import OfflineMonitorsView from '@/pages/dashboard/OfflineMonitorsView'
import OngoingMaintenanceView from '@/pages/dashboard/OngoingMaintenanceView'
import MonitorsPage from '@/pages/monitors/MonitorsPage'
import MonitorDetailPage from '@/pages/monitors/MonitorDetailPage'
import IncidentsPage from '@/pages/incidents/IncidentsPage'
import IncidentDetailPage from '@/pages/incidents/IncidentDetailPage'
import MaintenancePage from '@/pages/maintenance/MaintenancePage'
import StatusPagesPage from '@/pages/status-pages/StatusPagesPage'
import StatusPageDetailPage from '@/pages/status-pages/StatusPageDetailPage'
import PublicStatusPage from '@/pages/status-pages/PublicStatusPage'
import SubscriberVerifyPage from '@/pages/status-pages/SubscriberVerifyPage'
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
  { path: '/accept-invite', element: <RedirectIfAuth><AcceptInvitePage /></RedirectIfAuth> },
  { path: '/sso/callback', element: <SSOCallbackPage /> },
  { path: '/status/:slug/verify-email', element: <SubscriberVerifyPage type="email" /> },
  { path: '/status/:slug/verify-phone', element: <SubscriberVerifyPage type="phone" /> },
  { path: '/status/:slug', element: <PublicStatusPage /> },
  {
    path: '/',
    element: <RequireAuth><AppLayout /></RequireAuth>,
    children: [
      { index: true,                      element: <Navigate to="/dashboard" replace /> },
      {
        path: 'dashboard',
        element: <DashboardLayout />,
        children: [
          { index: true, element: <DashboardIndexRedirect /> },
          { path: 'active-incidents', element: <ActiveIncidentsView /> },
          { path: 'offline-monitors', element: <OfflineMonitorsView /> },
          { path: 'ongoing-maintenance', element: <OngoingMaintenanceView /> },
        ],
      },
      { path: 'monitors', element: <MonitorsLayout />, children: [
          { index: true, element: <MonitorsPage /> },
          { path: ':id', element: <MonitorDetailPage /> },
      ]},
      { path: 'incidents', element: <IncidentsLayout />, children: [
          { index: true, element: <IncidentsPage /> },
          { path: ':id', element: <IncidentDetailPage /> },
      ]},
      { path: 'maintenance', element: <MaintenanceLayout />, children: [
          { index: true, element: <MaintenancePage /> },
      ]},
      { path: 'status-pages', element: <StatusPagesLayout />, children: [
          { index: true, element: <StatusPagesPage /> },
          { path: ':id', element: <StatusPageDetailPage /> },
      ]},
      { path: 'webhooks', element: <WebhooksLayout />, children: [
          { index: true, element: <WebhooksPage /> },
          { path: ':id', element: <WebhookDetailPage /> },
      ]},
      { path: 'audit', element: <AuditLayout />, children: [
          { index: true, element: <AuditPage /> },
      ]},
      { path: 'users', element: <UsersLayout />, children: [
          { index: true, element: <UsersPage /> },
      ]},
      { path: 'settings', element: <SettingsLayout />, children: [
          { index: true, element: <SettingsPage /> },
      ]},
    ],
  },
  { path: '*', element: <Navigate to="/dashboard" replace /> },
])
