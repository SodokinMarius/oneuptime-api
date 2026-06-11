import { useQuery } from '@tanstack/react-query'
import { rbacApi } from '@/api/rbac'

interface Props {
  value: string
  onChange: (value: string) => void
  className?: string
}

export function TeamFilter({ value, onChange, className = '' }: Props) {
  const { data: teams } = useQuery({
    queryKey: ['teams'],
    queryFn: () => rbacApi.teams.list().then(r => r.data.results),
  })

  if (!teams?.length) return null

  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className={`input-field w-full sm:w-auto sm:min-w-[180px] ${className}`}
      aria-label="Filtrer par équipe"
    >
      <option value="">Toutes les équipes</option>
      {teams.map(t => (
        <option key={t.id} value={t.id}>{t.name}</option>
      ))}
    </select>
  )
}
