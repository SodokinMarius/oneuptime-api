import client from './client'
import type { PaginatedResponse } from '@/types'

export interface AuditEntry {
  id: string
  action: string
  resource_type: string
  resource_id: string | null
  actor_type: 'user' | 'api_key' | 'system'
  actor_id: string | null
  actor_label: string
  ip_address: string | null
  changes: Record<string, unknown> | null
  hash: string
  created_at: string
}

export interface RetentionPolicy {
  id: string
  data_type: string
  retention_days: number
  created_at: string
  updated_at: string
}

export const auditApi = {
  list: (params?: {
    action?: string
    resource_type?: string
    actor_type?: string
    since?: string
    until?: string
    page?: string
    page_size?: string
  }) =>
    client.get<PaginatedResponse<AuditEntry>>('/audit-log', { params }),

  get: (id: string) =>
    client.get<AuditEntry>(`/audit-log/${id}`),

  verify: () =>
    client.get<{ valid: boolean; checked: number; errors: string[] }>('/audit-log/verify'),

  export: (format: 'csv' | 'jsonl') =>
    client.get(`/audit-log/export`, {
      params: { format },
      responseType: 'blob',
    }),

  retentionPolicies: {
    list: () =>
      client.get<PaginatedResponse<RetentionPolicy>>('/retention-policies'),
    create: (data: { data_type: string; retention_days: number }) =>
      client.post<RetentionPolicy>('/retention-policies', data),
    update: (id: string, data: { retention_days: number }) =>
      client.put<RetentionPolicy>(`/retention-policies/${id}`, data),
    delete: (id: string) =>
      client.delete(`/retention-policies/${id}`),
  },
}
