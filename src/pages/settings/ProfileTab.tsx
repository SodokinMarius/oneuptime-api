import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { authApi } from '@/api/auth'
import { authStore } from '@/store/auth'

export default function ProfileTab() {
  const user = authStore.getUser()
  const [profile, setProfile] = useState({
    first_name: user?.first_name ?? '',
    last_name: user?.last_name ?? '',
    session_timeout_minutes: user?.session_timeout_minutes ?? 60,
  })
  const [profileSuccess, setProfileSuccess] = useState(false)
  const [profileError, setProfileError] = useState('')

  const [passwords, setPasswords] = useState({ old_password: '', new_password: '', confirm: '' })
  const [pwSuccess, setPwSuccess] = useState(false)
  const [pwError, setPwError] = useState('')

  const profileMutation = useMutation({
    mutationFn: () => authApi.updateProfile(profile),
    onSuccess: ({ data }) => {
      const current = authStore.getUser()
      if (current) authStore.save(authStore.getAccessToken()!, authStore.getRefreshToken()!, { ...current, ...data })
      setProfileSuccess(true)
      setTimeout(() => setProfileSuccess(false), 3000)
    },
    onError: (err: any) => {
      setProfileError(err.response?.data?.errors?.[0]?.message || 'Erreur lors de la mise à jour.')
    },
  })

  const pwMutation = useMutation({
    mutationFn: () => authApi.changePassword({ old_password: passwords.old_password, new_password: passwords.new_password }),
    onSuccess: () => {
      setPwSuccess(true)
      setPasswords({ old_password: '', new_password: '', confirm: '' })
      setTimeout(() => setPwSuccess(false), 3000)
    },
    onError: (err: any) => {
      setPwError(err.response?.data?.errors?.[0]?.message || err.response?.data?.detail || 'Mot de passe actuel incorrect.')
    },
  })

  const handlePwSubmit = () => {
    setPwError('')
    if (passwords.new_password !== passwords.confirm) {
      setPwError('Les mots de passe ne correspondent pas.')
      return
    }
    pwMutation.mutate()
  }

  return (
    <div className="space-y-8 max-w-lg">
      {/* Profile section */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-5">Informations personnelles</h3>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prénom</label>
              <input value={profile.first_name} onChange={e => setProfile(f => ({ ...f, first_name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nom</label>
              <input value={profile.last_name} onChange={e => setProfile(f => ({ ...f, last_name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input value={user?.email ?? ''} disabled
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-400 cursor-not-allowed" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Timeout de session (minutes)</label>
            <input type="number" min={5} max={1440} value={profile.session_timeout_minutes}
              onChange={e => setProfile(f => ({ ...f, session_timeout_minutes: Number(e.target.value) }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          {profileError && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{profileError}</p>}
          {profileSuccess && <p className="text-sm text-emerald-600 bg-emerald-50 rounded-lg px-3 py-2">✓ Profil mis à jour</p>}
          <button onClick={() => { setProfileError(''); profileMutation.mutate() }} disabled={profileMutation.isPending}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            {profileMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </div>

      {/* Password section */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-5">Changer le mot de passe</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mot de passe actuel</label>
            <input type="password" value={passwords.old_password}
              onChange={e => setPasswords(p => ({ ...p, old_password: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="••••••••" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nouveau mot de passe</label>
            <input type="password" value={passwords.new_password}
              onChange={e => setPasswords(p => ({ ...p, new_password: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="••••••••" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirmer le nouveau mot de passe</label>
            <input type="password" value={passwords.confirm}
              onChange={e => setPasswords(p => ({ ...p, confirm: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="••••••••" />
          </div>
          {pwError && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{pwError}</p>}
          {pwSuccess && <p className="text-sm text-emerald-600 bg-emerald-50 rounded-lg px-3 py-2">✓ Mot de passe modifié avec succès</p>}
          <button onClick={handlePwSubmit} disabled={pwMutation.isPending || !passwords.old_password || !passwords.new_password}
            className="bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            {pwMutation.isPending ? 'Modification...' : 'Modifier le mot de passe'}
          </button>
        </div>
      </div>

      {/* Context info */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-4">Contexte de session</h3>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Tenant ID</span>
            <span className="font-mono text-gray-700 text-xs bg-gray-50 px-2 py-1 rounded">{authStore.getTenantId() ?? '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Project ID</span>
            <span className="font-mono text-gray-700 text-xs bg-gray-50 px-2 py-1 rounded">{authStore.getProjectId() ?? '—'}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
