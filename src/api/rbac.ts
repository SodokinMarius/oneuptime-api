import client from './client'

export interface Role {
  id: string
  name: string
  description: string
  is_system: boolean
  permissions: string[]
  created_at: string
}

export interface Team {
  id: string
  name: string
  description: string
  created_at: string
}

export interface TeamMember {
  id: string
  user: { id: string; email: string; full_name: string }
  role: { id: string; name: string }
  granted_by: { id: string; email: string } | null
  created_at: string
}

export interface ApiKey {
  id: string
  name: string
  key_prefix: string
  permissions: string[]
  last_used_at: string | null
  expires_at: string | null
  created_at: string
  key?: string
}

export interface ResourcePolicy {
  id: string
  role: { id: string; name: string }
  resource_type: string
  resource_id: string | null
  effect: 'allow' | 'deny'
  created_at: string
}

export const rbacApi = {
  roles: {
    list: () => client.get<{ results: Role[] }>('/roles'),
    get: (id: string) => client.get<Role>(`/roles/${id}`),
    create: (data: { name: string; description?: string; permissions: string[] }) =>
      client.post<Role>('/roles', data),
    update: (id: string, data: Partial<Role>) => client.put<Role>(`/roles/${id}`, data),
    delete: (id: string) => client.delete(`/roles/${id}`),
    permissions: () => client.get<{ permissions: string[] }>('/roles/permissions'),
  },

  teams: {
    list: () => client.get<{ results: Team[] }>('/teams'),
    get: (id: string) => client.get<Team>(`/teams/${id}`),
    create: (data: { name: string; description?: string }) =>
      client.post<Team>('/teams', data),
    update: (id: string, data: { name: string; description?: string }) =>
      client.put<Team>(`/teams/${id}`, data),
    delete: (id: string) => client.delete(`/teams/${id}`),
    members: (id: string) => client.get<TeamMember[]>(`/teams/${id}/members`),
    addMember: (id: string, email: string, role_id: string) =>
      client.post<TeamMember>(`/teams/${id}/members`, { email, role_id }),
    removeMember: (teamId: string, userId: string) =>
      client.delete(`/teams/${teamId}/members/${userId}`),
  },

  apiKeys: {
    list: () => client.get<ApiKey[]>('/api-keys'),
    create: (data: { name: string; permissions: string[]; expires_at?: string }) =>
      client.post<ApiKey>('/api-keys', data),
    revoke: (id: string) => client.delete(`/api-keys/${id}`),
  },

  resourcePolicies: {
    list: (params?: { resource_type?: string; resource_id?: string }) =>
      client.get<{ results: ResourcePolicy[] }>('/resource-policies', { params }),
    create: (data: { role: string; resource_type: string; resource_id?: string; effect: 'allow' | 'deny' }) =>
      client.post<ResourcePolicy>('/resource-policies', data),
    update: (id: string, data: Partial<ResourcePolicy>) =>
      client.put<ResourcePolicy>(`/resource-policies/${id}`, data),
    delete: (id: string) =>
      client.delete(`/resource-policies/${id}`),
  },
}
