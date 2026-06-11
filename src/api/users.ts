import client from './client'
import type { PaginatedResponse } from '@/types'

export interface TenantUser {
  id: string
  email: string
  full_name: string
  first_name: string
  last_name: string
  is_active: boolean
  is_email_verified: boolean
  created_at: string
}

export const usersApi = {
  list: (params?: { search?: string; page?: string }) =>
    client.get<PaginatedResponse<TenantUser>>('/users', { params }),

  get: (id: string) =>
    client.get<TenantUser>(`/users/${id}`),

  invite: (email: string) =>
    client.post('/users/invite', { email }),

  deactivate: (id: string) =>
    client.post(`/users/${id}/deactivate`),
}
