import { useState } from 'react'
import RolesTab from './RolesTab'
import TeamsTab from './TeamsTab'
import ApiKeysTab from './ApiKeysTab'
import ProfileTab from './ProfileTab'
import ResourcePoliciesTab from './ResourcePoliciesTab'
import SSOTab from './SSOTab'

const TABS = [
  { id: 'profile',   label: '👤 Profil' },
  { id: 'roles',     label: '🔐 Rôles' },
  { id: 'teams',     label: '👥 Équipes' },
  { id: 'apikeys',   label: '🔑 Clés API' },
  { id: 'policies',  label: '🛡️ Politiques' },
  { id: 'sso',       label: '🔒 SSO' },
] as const

type TabId = typeof TABS[number]['id']

export default function SettingsPage() {
  const [active, setActive] = useState<TabId>('profile')

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Paramètres</h2>
        <p className="text-gray-500 text-sm mt-1">Gérez votre profil, vos rôles, équipes, clés API et SSO</p>
      </div>

      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-6 flex-wrap w-full sm:w-fit">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActive(t.id)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
              active === t.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {active === 'profile'  && <ProfileTab />}
      {active === 'roles'    && <RolesTab />}
      {active === 'teams'    && <TeamsTab />}
      {active === 'apikeys'  && <ApiKeysTab />}
      {active === 'policies' && <ResourcePoliciesTab />}
      {active === 'sso'      && <SSOTab />}
    </div>
  )
}
