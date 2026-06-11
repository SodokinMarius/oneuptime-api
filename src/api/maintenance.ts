import client from './client'
import type { Maintenance, PaginatedResponse } from '@/types'

export const maintenanceApi = {
  list: (params?: Record<string, string>) =>
    client.get<PaginatedResponse<Maintenance>>('/scheduled-maintenance', { params }),

  get: (id: string) =>
    client.get<Maintenance>(`/scheduled-maintenance/${id}`),

  create: (data: Partial<Maintenance>) =>
    client.post<Maintenance>('/scheduled-maintenance', data),

  update: (id: string, data: Partial<Maintenance>) =>
    client.put<Maintenance>(`/scheduled-maintenance/${id}`, data),

  delete: (id: string) =>
    client.delete(`/scheduled-maintenance/${id}`),

  cancel: (id: string) =>
    client.post(`/scheduled-maintenance/${id}/cancel`),
}
