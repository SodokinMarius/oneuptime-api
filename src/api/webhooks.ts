import client from './client'
import type { Webhook, PaginatedResponse } from '@/types'

export interface WebhookDelivery {
  id: string
  event: string
  url: string
  status: 'pending' | 'success' | 'failed' | 'exhausted'
  response_status: number | null
  response_body: string | null
  attempt: number
  next_retry_at: string | null
  delivered_at: string | null
  created_at: string
}

export const webhooksApi = {
  list: (params?: Record<string, string>) =>
    client.get<PaginatedResponse<Webhook>>('/webhooks', { params }),

  get: (id: string) =>
    client.get<Webhook>(`/webhooks/${id}`),

  create: (data: {
    name: string
    url: string
    event_types: string[]
    secret?: string
    payload_format?: string
    team_id?: string | null
  }) =>
    client.post<Webhook>('/webhooks', data),

  update: (id: string, data: Partial<Webhook>) =>
    client.put<Webhook>(`/webhooks/${id}`, data),

  delete: (id: string) =>
    client.delete(`/webhooks/${id}`),

  deliveries: (id: string) =>
    client.get<WebhookDelivery[]>(`/webhooks/${id}/deliveries`),

  retry: (webhookId: string, deliveryId: string) =>
    client.post(`/webhooks/${webhookId}/deliveries/${deliveryId}/retry`),
}
