import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { authStore } from '@/store/auth'

/** Switch active project context and reload app data. */
export function useProjectSwitch() {
  const qc = useQueryClient()
  const navigate = useNavigate()

  return (projectId: string, projectName: string, slug?: string) => {
    const tenantId = authStore.getTenantId()
    if (!tenantId) return

    authStore.switchProject(tenantId, projectId, projectName, slug)
    qc.clear()
    navigate('/dashboard', { replace: true })
  }
}
