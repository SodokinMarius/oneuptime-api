import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { rbacApi, type Team } from '@/api/rbac'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'
import { IconUsers } from '@/components/ui/Icons'

function AddMemberForm({ teamId, onSuccess }: { teamId: string; onSuccess: () => void }) {
  const [form, setForm] = useState({ email: '', role_id: '' })
  const [error, setError] = useState('')

  const { data: roles, isError: rolesError } = useQuery({
    queryKey: ['roles'],
    queryFn: () => rbacApi.roles.listAll(),
  })

  const mut = useMutation({
    mutationFn: () => rbacApi.teams.addMember(teamId, form.email, form.role_id),
    onSuccess,
    onError: (err: any) => {
      const d = err.response?.data
      const msg = d?.detail || d?.errors?.[0]?.message || 'Error'
      setError(
        msg.includes('No User matches') || msg.includes('404')
          ? 'No user found with this email.'
          : msg
      )
    },
  })

  return (
    <form onSubmit={e => { e.preventDefault(); setError(''); mut.mutate() }} className="space-y-4">
      <div>
        <label className="label">User email *</label>
        <input
          type="email"
          required
          value={form.email}
          onChange={e => setForm({ ...form, email: e.target.value })}
          className="input-field"
          placeholder="colleague@example.com"
          autoComplete="off"
        />
        <p className="text-xs text-gray-400 mt-1">
          The user must first be invited to the organization (Users page) and accept.
          Adding to a team does not send an email.
        </p>
      </div>
      <div>
        <label className="label">Role *</label>
        <select required value={form.role_id} onChange={e => setForm({ ...form, role_id: e.target.value })}
          className="input-field">
          <option value="">Select a role...</option>
          {roles?.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        {rolesError && (
          <p className="text-xs text-red-600 mt-1">Unable to load roles.</p>
        )}
        {!rolesError && roles && roles.length === 0 && (
          <p className="text-xs text-amber-600 mt-1">No roles available in this project.</p>
        )}
      </div>
      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>}
      <div className="flex justify-end">
        <button type="submit" disabled={mut.isPending || !form.email || !form.role_id}
          className="btn-primary disabled:opacity-50">
          {mut.isPending ? 'Adding...' : 'Add member'}
        </button>
      </div>
    </form>
  )
}

function TeamCard({ team }: { team: Team }) {
  const qc = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const { data: members, isLoading: membersLoading, isFetching: membersFetching, isError: membersError } = useQuery({
    queryKey: ['team-members', team.id],
    queryFn: () => rbacApi.teams.members(team.id).then(r => r.data),
    enabled: expanded,
    retry: 1,
  })

  const removeMut = useMutation({
    mutationFn: (userId: string) => rbacApi.teams.removeMember(team.id, userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['team-members', team.id] }),
  })

  const deleteMut = useMutation({
    mutationFn: () => rbacApi.teams.delete(team.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['teams'] }),
  })

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3">
        <button className="flex-1 text-left" onClick={() => setExpanded(!expanded)}>
          <span className="font-medium text-gray-900">{team.name}</span>
          {team.description && <span className="text-sm text-gray-400 ml-2">{team.description}</span>}
        </button>
        <div className="flex gap-2">
          <button onClick={() => { setExpanded(true); setShowAdd(true) }}
            className="text-xs border border-blue-200 text-blue-600 px-2.5 py-1 rounded-lg hover:bg-blue-50 transition-colors">
            + Member
          </button>
          <button onClick={() => { if (confirm('Delete this team?')) deleteMut.mutate() }}
            className="text-xs border border-red-200 text-red-500 px-2 py-1 rounded-lg hover:bg-red-50 transition-colors">
            Del.
          </button>
          <span className="text-gray-400 cursor-pointer px-1" onClick={() => setExpanded(!expanded)}>
            {expanded ? '▲' : '▼'}
          </span>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50 px-5 py-4">
          {membersLoading || (membersFetching && !members) ? (
            <div className="flex justify-center py-4">
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : membersError ? (
            <p className="text-sm text-red-400 text-center py-3">Unable to load members.</p>
          ) : members && members.length > 0 ? (
            <div className="space-y-2">
              {membersFetching && (
                <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-2">
                  <div className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin" />
                  Updating...
                </div>
              )}
              {members.map((m: any) => (
                <div key={m.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-gray-100">
                  <div>
                    <span className="text-sm font-medium text-gray-800">{m.user?.full_name || m.user?.email}</span>
                    <span className="text-xs text-gray-400 ml-2">{m.user?.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{m.role?.name}</span>
                    <button onClick={() => removeMut.mutate(m.user?.id)}
                      className="text-xs text-red-400 hover:text-red-600 transition-colors">✕</button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-3">No members in this team.</p>
          )}
        </div>
      )}

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title={`Add member — ${team.name}`} size="sm">
        <AddMemberForm teamId={team.id} onSuccess={() => {
          setShowAdd(false)
          qc.invalidateQueries({ queryKey: ['team-members', team.id] })
        }} />
      </Modal>
    </div>
  )
}

export default function TeamsTab() {
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [newTeam, setNewTeam] = useState({ name: '', description: '' })
  const [createError, setCreateError] = useState('')

  const { data: teams, isLoading } = useQuery({
    queryKey: ['teams'],
    queryFn: () => rbacApi.teams.listAll(),
  })

  const createMut = useMutation({
    mutationFn: () => rbacApi.teams.create(newTeam),
    onSuccess: () => {
      setShowCreate(false)
      setNewTeam({ name: '', description: '' })
      qc.invalidateQueries({ queryKey: ['teams'] })
    },
    onError: (err: any) => {
      const d = err.response?.data
      setCreateError(d?.detail || d?.errors?.[0]?.message || 'Error')
    },
  })

  if (isLoading) return <div className="flex justify-center py-12"><div className="w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-gray-500">{teams?.length ?? 0} team(s)</p>
        <button onClick={() => setShowCreate(true)}
          className="btn-primary">
          + New team
        </button>
      </div>

      {!teams?.length ? (
        <EmptyState icon={<IconUsers size={24} />} title="No teams" description="Create teams to organize access." />
      ) : (
        <div className="space-y-3">
          {teams.map((t: Team) => <TeamCard key={t.id} team={t} />)}
        </div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New team" size="sm">
        <form onSubmit={e => { e.preventDefault(); setCreateError(''); createMut.mutate() }} className="space-y-4">
          <div>
            <label className="label">Nom *</label>
            <input required value={newTeam.name} onChange={e => setNewTeam({ ...newTeam, name: e.target.value })}
              className="input-field"
              placeholder="Backend team, DevOps..." />
          </div>
          <div>
            <label className="label">Description</label>
            <input value={newTeam.description} onChange={e => setNewTeam({ ...newTeam, description: e.target.value })}
              className="input-field" />
          </div>
          {createError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{createError}</div>}
          <div className="flex justify-end">
            <button type="submit" disabled={createMut.isPending}
              className="btn-primary disabled:opacity-50">
              {createMut.isPending ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
