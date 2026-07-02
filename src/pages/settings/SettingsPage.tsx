import { useState, useEffect } from 'react'
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
import { PageShell } from '@/components/ui/PageShell'
import { PageHeader } from '@/components/ui/PageHeader'
import { Tabs } from '@/components/ui/Tabs'

const TABS = [
  { id: 'profile', label: 'Profile' },
  { id: 'projects', label: 'Projects' },
  { id: 'roles', label: 'Roles' },
  { id: 'teams', label: 'Teams' },
  { id: 'escalation', label: 'Escalation' },
  { id: 'workflows', label: 'Workflows' },
  { id: 'apikeys', label: 'API keys' },
  { id: 'policies', label: 'Policies' },
  { id: 'sso', label: 'SSO' },
] as const

type TabId = typeof TABS[number]['id']

export default function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tabFromUrl = searchParams.get('tab') as TabId | null
  const [active, setActive] = useState<TabId>(
    tabFromUrl && TABS.some(t => t.id === tabFromUrl) ? tabFromUrl : 'profile'
  )

  useEffect(() => {
    if (tabFromUrl && TABS.some(t => t.id === tabFromUrl)) {
      setActive(tabFromUrl)
    }
  }, [tabFromUrl])

  const handleTabChange = (id: TabId) => {
    setActive(id)
    setSearchParams(id === 'profile' ? {} : { tab: id }, { replace: true })
  }

  return (
    <PageShell>
      <PageHeader
        title="Settings"
        subtitle="Profile, projects, roles, teams, incident automation, API keys, and SSO"
      />

      <Tabs tabs={[...TABS]} active={active} onChange={handleTabChange} />

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
    </PageShell>
  )
}
