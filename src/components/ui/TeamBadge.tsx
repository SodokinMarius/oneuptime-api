interface Props {
  teamId: string | null | undefined
  teamName: string | null | undefined
  className?: string
}

export function TeamBadge({ teamId, teamName, className = '' }: Props) {
  if (!teamId) {
    return (
      <span className={`text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 ${className}`}>
        Shared
      </span>
    )
  }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 ${className}`}>
      {teamName || 'Team'}
    </span>
  )
}
