import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { usersApi } from '@/api/users'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'
import { IconUsers } from '@/components/ui/Icons'
import { formatDate } from '@/utils/format'

export default function UsersPage() {
  const [search, setSearch] = useState('')
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteError, setInviteError] = useState('')
  const [inviteSuccess, setInviteSuccess] = useState(false)
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['users', search],
    queryFn: () => usersApi.list({ search: search || undefined }).then(r => r.data),
  })

  const inviteMutation = useMutation({
    mutationFn: () => usersApi.invite(inviteEmail),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      setInviteSuccess(true)
      setInviteEmail('')
    },
    onError: (err: any) => {
      const msg = err.response?.data?.errors?.[0]?.message || err.response?.data?.detail || 'Erreur lors de l\'invitation.'
      setInviteError(msg)
    },
  })

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => usersApi.deactivate(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  })

  const users = data?.results ?? []

  const handleCloseInvite = () => {
    setShowInvite(false)
    setInviteEmail('')
    setInviteError('')
    setInviteSuccess(false)
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Utilisateurs</h2>
          <p className="text-gray-500 text-sm mt-1">Membres de votre organisation</p>
        </div>
        <button onClick={() => setShowInvite(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors w-full sm:w-auto">
          + Inviter un utilisateur
        </button>
      </div>

      {/* Search */}
      <div className="mb-6">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher par nom ou email..."
          className="w-full max-w-sm px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : users.length === 0 ? (
        <EmptyState icon={<IconUsers size={24} />} title="Aucun utilisateur trouvé"
          description="Invitez des collaborateurs à rejoindre votre organisation."
          action={<button onClick={() => setShowInvite(true)} className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">+ Inviter</button>} />
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Utilisateur</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide hidden sm:table-cell">Email</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Statut</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide hidden md:table-cell">Membre depuis</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map(user => (
                <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-medium text-sm shrink-0">
                        {(user.first_name?.[0] || user.email[0]).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <span className="font-medium text-gray-800 block truncate">{user.full_name || '—'}</span>
                        <span className="text-xs text-gray-400 sm:hidden truncate block">{user.email}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-gray-500 hidden sm:table-cell">{user.email}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${user.is_active ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                      <span className={`text-xs font-medium ${user.is_active ? 'text-emerald-600' : 'text-gray-400'}`}>
                        {user.is_active ? 'Actif' : 'Désactivé'}
                      </span>
                      {!user.is_email_verified && (
                        <span className="text-xs bg-yellow-100 text-yellow-600 px-1.5 py-0.5 rounded">En attente</span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-gray-500 hidden md:table-cell">{formatDate(user.created_at)}</td>
                  <td className="px-5 py-3 text-right">
                    {user.is_active && (
                      <button onClick={() => { if (confirm(`Désactiver ${user.email} ?`)) deactivateMutation.mutate(user.id) }}
                        className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50 transition-colors whitespace-nowrap">
                        Désactiver
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      <Modal open={showInvite} onClose={handleCloseInvite} title="Inviter un utilisateur" size="sm">
        {inviteSuccess ? (
          <div className="text-center py-4">
            <p className="text-4xl mb-3">✉️</p>
            <p className="text-sm font-medium text-gray-800 mb-1">Invitation envoyée !</p>
            <p className="text-sm text-gray-500 mb-6">L'utilisateur recevra un email pour rejoindre votre organisation.</p>
            <button onClick={handleCloseInvite} className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
              Fermer
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Adresse email</label>
              <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="collegue@exemple.com" />
            </div>
            {inviteError && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{inviteError}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={handleCloseInvite} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors">Annuler</button>
              <button onClick={() => inviteMutation.mutate()} disabled={inviteMutation.isPending || !inviteEmail}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm rounded-lg transition-colors">
                {inviteMutation.isPending ? 'Envoi...' : 'Envoyer l\'invitation'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
