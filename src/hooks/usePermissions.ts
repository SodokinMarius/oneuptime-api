import { useQuery } from '@tanstack/react-query'
import { authApi } from '@/api/auth'

export function usePermissions() {
  const { data, isLoading } = useQuery({
    queryKey: ['me-permissions'],
    queryFn: () => authApi.permissions().then(r => r.data.permissions),
    staleTime: 60_000,
  })

  return {
    permissions: data ?? [],
    isLoading,
  }
}
