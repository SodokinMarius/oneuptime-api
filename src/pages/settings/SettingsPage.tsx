import { useState } from 'react'
import RolesTab from './RolesTab'
import TeamsTab from './TeamsTab'
import ApiKeysTab from './ApiKeysTab'
import ProfileTab from './ProfileTab'
import ResourcePoliciesTab from './ResourcePoliciesTab'
import SSOTab from './SSOTab'
import { PageShell } from '@/components/ui/PageShell'
import { PageHeader } from '@/components/ui/PageHeader'
import { Tabs } from '@/components/ui/Tabs'

const TABS = [
  { id: 'profile', label: 'Profil' },
  { id: 'roles', label: 'Rôles' },
  { id: 'teams', label: 'Équipes' },
  { id: 'apikeys', label: 'Clés API' },
  { id: 'policies', label: 'Politiques' },
  { id: 'sso', label: 'SSO' },
] as const

type TabId = typeof TABS[number]['id']

export default function SettingsPage() {
  const [active, setActive] = useState<TabId>('profile')

  return (
    <PageShell>
      <PageHeader
        title="Paramètres"
        subtitle="Profil, rôles, équipes, clés API et SSO"
      />

      <Tabs tabs={[...TABS]} active={active} onChange={setActive} />

      <div className="card p-4 sm:p-6">
        {active === 'profile' && <ProfileTab />}
        {active === 'roles' && <RolesTab />}
        {active === 'teams' && <TeamsTab />}
        {active === 'apikeys' && <ApiKeysTab />}
        {active === 'policies' && <ResourcePoliciesTab />}
        {active === 'sso' && <SSOTab />}
      </div>
    </PageShell>
  )
}
