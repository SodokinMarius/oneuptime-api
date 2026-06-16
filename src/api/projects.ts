import client from './client'
import { extractResults } from '@/utils/api'

export interface Project {
  id: string
  name: string
  slug: string
  description: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ProjectPayload {
  name: string
  slug: string
  description?: string
}

export const projectsApi = {
  list: (params?: { active?: boolean }) =>
    client.get<{ results: Project[] } | Project[]>('/projects', { params }),

  listAll: async (params?: { active?: boolean }): Promise<Project[]> => {
    const { data } = await projectsApi.list(params)
    return extractResults(data)
  },

  get: (id: string) => client.get<Project>(`/projects/${id}`),

  create: (payload: ProjectPayload) => client.post<Project>('/projects', payload),

  update: (id: string, payload: Partial<ProjectPayload>) =>
    client.patch<Project>(`/projects/${id}`, payload),

  deactivate: (id: string) => client.delete(`/projects/${id}`),
}
