import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { rbacApi } from '@/api/rbac'

interface Props {
  value: string
  onChange: (value: string) => void
  /** Show "Partagé" option (team_id=null) — typically for admins */
  allowShared?: boolean
  className?: string
}

export function TeamSelect({ value, onChange, allowShared = false, className = '' }: Props) {
  const { data: teams, isLoading } = useQuery({
    queryKey: ['teams'],
    queryFn: () => rbacApi.teams.list().then(r => r.data.results),
  })

  useEffect(() => {
    if (!teams?.length || value) return
    if (teams.length === 1 && !allowShared) {
      onChange(teams[0].id)
    }
  }, [teams, value, onChange, allowShared])

  if (isLoading) {
    return <p className="text-sm text-gray-400">Chargement des équipes…</p>
  }

  if (!teams?.length) {
    return (
      <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
        Aucune équipe disponible. Rejoignez une équipe dans les paramètres.
      </p>
    )
  }

  if (teams.length === 1 && !allowShared) {
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Équipe</label>
        <p className="text-sm text-gray-600 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg">
          {teams[0].name}
        </p>
      </div>
    )
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Équipe</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className={`w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${className}`}
      >
        {allowShared && <option value="">Partagé (tout le projet)</option>}
        {!allowShared && <option value="">Équipe par défaut</option>}
        {teams.map(t => (
          <option key={t.id} value={t.id}>{t.name}</option>
        ))}
      </select>
      {allowShared && (
        <p className="text-xs text-gray-400 mt-1">
          « Partagé » = visible par tous les membres du projet.
        </p>
      )}
    </div>
  )
}
