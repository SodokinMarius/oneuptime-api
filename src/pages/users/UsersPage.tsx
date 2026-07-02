import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { usersApi } from '@/api/users'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageShell } from '@/components/ui/PageShell'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { IconPlus, IconUsers } from '@/components/ui/Icons'
import { formatDate } from '@/utils/format'

export default function UsersPage() {
  const [search, setSearch] = useState('')
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteError, setInviteError] = useState('')
  const [inviteSuccess, setInviteSuccess] = useState(false)
  const [inviteWarning, setInviteWarning] = useState('')
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['users', search],
    queryFn: () => usersApi.list({ search: search || undefined }).then(r => r.data),
  })

  const inviteMutation = useMutation({
    mutationFn: () => usersApi.invite(inviteEmail),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['users'] })
      const detail = res.data?.detail as string | undefined
      if (detail?.includes('email could not be sent') || detail?.includes('SMTP')) {
        setInviteWarning(detail)
      }
      setInviteSuccess(true)
      setInviteEmail('')
    },
    onError: (err: any) => {
      const msg = err.response?.data?.errors?.[0]?.message || err.response?.data?.detail || 'Error sending invitation.'
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
    setInviteWarning('')
  }

  return (
    <PageShell>
      <PageHeader
        title="Users"
        subtitle="Active members of your organization"
        actions={
          <Button onClick={() => setShowInvite(true)} fullWidth>
            <IconPlus size={16} />
            Invite user
          </Button>
        }
      />

      <div className="filter-bar">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or email…"
          className="input-field w-full sm:max-w-sm"
        />
      </div>

      {isLoading ? (
        <Spinner label="Loading…" />
      ) : users.length === 0 ? (
        <EmptyState
          icon={<IconUsers size={24} />}
          title="No users found"
          description="Invite teammates to join your organization."
          action={
            <Button onClick={() => setShowInvite(true)}>
              <IconPlus size={16} />
              Invite
            </Button>
          }
        />
      ) : (
        <div className="table-wrap">
          <div className="table-scroll">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  <th className="table-th">User</th>
                  <th className="table-th hidden sm:table-cell">Email</th>
                  <th className="table-th">Status</th>
                  <th className="table-th hidden md:table-cell">Member since</th>
                  <th className="table-th text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {users.map(user => (
                  <tr key={user.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="table-td">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-600 font-medium text-sm shrink-0">
                          {(user.first_name?.[0] || user.email[0]).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <span className="font-medium text-gray-800 block truncate">{user.full_name || '—'}</span>
                          <span className="text-xs text-gray-400 sm:hidden truncate block">{user.email}</span>
                        </div>
                      </div>
                    </td>
                    <td className="table-td text-gray-500 hidden sm:table-cell">{user.email}</td>
                    <td className="table-td">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${user.is_active ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                        <span className={`text-xs font-medium ${user.is_active ? 'text-emerald-600' : 'text-gray-400'}`}>
                          {user.is_active ? 'Active' : 'Disabled'}
                        </span>
                        {!user.is_email_verified && (
                          <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Pending</span>
                        )}
                      </div>
                    </td>
                    <td className="table-td text-gray-500 hidden md:table-cell">{formatDate(user.created_at)}</td>
                    <td className="table-td text-right">
                      {user.is_active && (
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => { if (confirm(`Deactivate ${user.email}?`)) deactivateMutation.mutate(user.id) }}
                        >
                          Deactivate
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={showInvite} onClose={handleCloseInvite} title="Invite user" size="sm">
        {inviteSuccess ? (
          <div className="text-center py-4">
            <p className="text-4xl mb-3">✉️</p>
            <p className="text-sm font-medium text-gray-800 mb-1">
              {inviteWarning ? 'Invitation created' : 'Invitation sent!'}
            </p>
            {inviteWarning ? (
              <p className="text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2 mb-6">{inviteWarning}</p>
            ) : (
              <p className="text-sm text-gray-500 mb-6">The user will receive an email to join your organization.</p>
            )}
            <Button onClick={handleCloseInvite}>Close</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="label">Email address</label>
              <input
                type="email"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                className="input-field"
                placeholder="colleague@example.com"
              />
            </div>
            {inviteError && <p className="form-error">{inviteError}</p>}
            <div className="form-actions">
              <Button variant="secondary" onClick={handleCloseInvite}>Cancel</Button>
              <Button
                onClick={() => inviteMutation.mutate()}
                disabled={inviteMutation.isPending || !inviteEmail}
              >
                {inviteMutation.isPending ? 'Sending…' : 'Send invitation'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </PageShell>
  )
}
