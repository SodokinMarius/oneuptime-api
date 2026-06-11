/** Append optional team_id filter to list API params. */
export function withTeamFilter(
  params: Record<string, string>,
  teamFilter: string,
): Record<string, string> {
  if (!teamFilter) return params
  return { ...params, team_id: teamFilter }
}

/**
 * Build team_id for create requests.
 * - teamId set → assign to that team
 * - empty + allowShared → explicit null (shared resource, admin only)
 * - empty otherwise → omit (backend auto-assigns user's first team)
 */
export function teamIdPayload(
  teamId: string,
  allowShared = false,
): { team_id?: string | null } {
  if (teamId) return { team_id: teamId }
  if (allowShared) return { team_id: null }
  return {}
}
