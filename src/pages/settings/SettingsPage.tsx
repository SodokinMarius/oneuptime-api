import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import RolesTab from './RolesTab'
import TeamsTab from './TeamsTab'
import ApiKeysTab from './ApiKeysTab'
import ProfileTab from './ProfileTab'
import ResourcePoliciesTab from './ResourcePoliciesTab'
import SSOTab from './SSOTab'
import ProjectsTab from './ProjectsTab'
import EscalationTab from './EscalationTab'
import WorkflowsTab from './WorkflowsTab'
import { ListPageLayout } from '@/components/layout/ListPageLayout'
import { usePermissions } from '@/hooks/usePermissions'
import { hasPermission } from '@/utils/permissions'

const ALL_TABS = [
  { id: 'profile', label: 'Profile', permission: null },
  { id: 'projects', label: 'Projects', permission: 'project:read' },
  { id: 'roles', label: 'Roles', permission: 'role:read' },
  { id: 'teams', label: 'Teams', permission: 'team:read' },
  { id: 'escalation', label: 'Escalation', permission: 'incident:read' },
  { id: 'workflows', label: 'Workflows', permission: 'incident:read' },
  { id: 'apikeys', label: 'API keys', permission: 'api_key:read' },
  { id: 'policies', label: 'Policies', permission: 'rbac:read' },
  { id: 'sso', label: 'SSO', permission: 'project:manage_sso' },
] as const

type TabId = typeof ALL_TABS[number]['id']

const TAB_LABELS: Record<TabId, string> = {
  profile: 'Profile',
  projects: 'Projects',
  roles: 'Roles',
  teams: 'Teams',
  escalation: 'Escalation',
  workflows: 'Workflows',
  apikeys: 'API keys',
  policies: 'Policies',
  sso: 'SSO',
}

export default function SettingsPage() {
  const [searchParams] = useSearchParams()
  const { permissions } = usePermissions()
  const tabs = useMemo(
    () => ALL_TABS.filter(tab => !tab.permission || hasPermission(permissions, tab.permission)),
    [permissions],
  )
  const tabFromUrl = searchParams.get('tab') as TabId | null
  const [active, setActive] = useState<TabId>(
    tabFromUrl && tabs.some(t => t.id === tabFromUrl) ? tabFromUrl : 'profile'
  )

  useEffect(() => {
    if (tabFromUrl && tabs.some(t => t.id === tabFromUrl)) {
      setActive(tabFromUrl)
    } else if (!tabs.some(t => t.id === active)) {
      setActive(tabs[0]?.id ?? 'profile')
    }
  }, [tabFromUrl, tabs, active])

  return (
    <ListPageLayout
      embedded
      breadcrumbs={[
        { label: 'Project Settings', to: '/settings' },
        { label: TAB_LABELS[active] },
      ]}
      title={TAB_LABELS[active]}
      subtitle="Profile, projects, roles, teams, incident automation, API keys, and SSO"
    >
      <div className="card p-4 sm:p-6">
        {active === 'profile' && <ProfileTab />}
        {active === 'projects' && <ProjectsTab />}
        {active === 'roles' && <RolesTab />}
        {active === 'teams' && <TeamsTab />}
        {active === 'escalation' && <EscalationTab />}
        {active === 'workflows' && <WorkflowsTab />}
        {active === 'apikeys' && <ApiKeysTab />}
        {active === 'policies' && <ResourcePoliciesTab />}
        {active === 'sso' && <SSOTab />}
      </div>
    </ListPageLayout>
  )
}
