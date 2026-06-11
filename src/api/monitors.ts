import client from './client'
import type { Monitor, MonitorCheck, UptimeStats, MonitorGroup, PaginatedResponse } from '@/types'

export interface Probe {
  id: string
  name: string
  region: string
  is_active: boolean
  last_ping_at: string | null
  latency_ms: number | null
}

export interface StatusTimeline {
  from: string
  to: string
  status: string
  duration_seconds: number
}

export const monitorsApi = {
  list: (params?: Record<string, string>) =>
    client.get<PaginatedResponse<Monitor>>('/monitors', { params }),

  get: (id: string) =>
    client.get<Monitor>(`/monitors/${id}`),

  create: (data: Partial<Monitor>) =>
    client.post<Monitor>('/monitors', data),

  update: (id: string, data: Partial<Monitor>) =>
    client.put<Monitor>(`/monitors/${id}`, data),

  delete: (id: string) =>
    client.delete(`/monitors/${id}`),

  pause: (id: string) =>
    client.post(`/monitors/${id}/pause`),

  resume: (id: string) =>
    client.post(`/monitors/${id}/resume`),

  logs: (id: string, params?: Record<string, string>) =>
    client.get<PaginatedResponse<MonitorCheck>>(`/monitors/${id}/logs`, { params }),

  uptime: (id: string, days = 30) =>
    client.get<UptimeStats>(`/monitors/${id}/uptime`, { params: { days } }),

  statusTimeline: (id: string, params?: Record<string, string>) =>
    client.get<StatusTimeline[]>(`/monitors/${id}/status-timeline`, { params }),

  bulk: (monitors: Partial<Monitor>[]) =>
    client.post<Monitor[]>('/monitors/bulk', { monitors }),

  groups: {
    list: (params?: Record<string, string>) =>
      client.get<PaginatedResponse<MonitorGroup>>('/monitor-groups', { params }),

    get: (id: string) =>
      client.get<MonitorGroup>(`/monitor-groups/${id}`),

    create: (data: Partial<MonitorGroup>) =>
      client.post<MonitorGroup>('/monitor-groups', data),

    update: (id: string, data: Partial<MonitorGroup>) =>
      client.put<MonitorGroup>(`/monitor-groups/${id}`, data),

    delete: (id: string) =>
      client.delete(`/monitor-groups/${id}`),
  },

  probes: {
    list: () =>
      client.get<PaginatedResponse<Probe>>('/probes'),

    health: (id: string) =>
      client.get(`/probes/${id}/health`),
  },
}
