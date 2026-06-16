import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import RolesTab from './RolesTab'
import TeamsTab from './TeamsTab'
import ApiKeysTab from './ApiKeysTab'
import ProfileTab from './ProfileTab'
import ResourcePoliciesTab from './ResourcePoliciesTab'
import SSOTab from './SSOTab'
import ProjectsTab from './ProjectsTab'
import { PageShell } from '@/components/ui/PageShell'
import { PageHeader } from '@/components/ui/PageHeader'
import { Tabs } from '@/components/ui/Tabs'

const TABS = [
  { id: 'profile', label: 'Profil' },
  { id: 'projects', label: 'Projets' },
  { id: 'roles', label: 'Rôles' },
  { id: 'teams', label: 'Équipes' },
  { id: 'apikeys', label: 'Clés API' },
  { id: 'policies', label: 'Politiques' },
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
        title="Paramètres"
        subtitle="Profil, projets, rôles, équipes, clés API et SSO"
      />

      <Tabs tabs={[...TABS]} active={active} onChange={handleTabChange} />

      <div className="card p-4 sm:p-6">
        {active === 'profile' && <ProfileTab />}
        {active === 'projects' && <ProjectsTab />}
        {active === 'roles' && <RolesTab />}
        {active === 'teams' && <TeamsTab />}
        {active === 'apikeys' && <ApiKeysTab />}
        {active === 'policies' && <ResourcePoliciesTab />}
        {active === 'sso' && <SSOTab />}
      </div>
    </PageShell>
  )
}
