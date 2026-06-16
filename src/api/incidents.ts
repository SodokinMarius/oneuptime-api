import client from './client'
import type { Incident, IncidentNote, IncidentState, IncidentSeverityObj, PaginatedResponse } from '@/types'

export interface TimelineEntry {
  id?: string
  type?: string
  event_type?: string
  message?: string
  content?: string
  action?: string
  at?: string
  created_at?: string
  actor?: { id: string; email: string; full_name: string } | null
  actor_id?: string | null
  is_public?: boolean
}

export interface Postmortem {
  id: string
  summary: string
  root_cause: string
  impact: string
  timeline: string
  action_items: string | string[]
  published: boolean
  published_at?: string | null
  created_at: string
  updated_at: string
}

export function unwrapIncidentList<T>(data: T[] | PaginatedResponse<T>): T[] {
  return Array.isArray(data) ? data : data.results
}

export const incidentsApi = {
  list: (params?: Record<string, string>) =>
    client.get<PaginatedResponse<Incident>>('/incidents', { params }),

  get: (id: string) =>
    client.get<Incident>(`/incidents/${id}`),

  create: (data: Partial<Incident> & { state_id?: string; severity_id?: string; team_id?: string | null }) => {
    const { state_id, severity_id, ...rest } = data
    return client.post<Incident>('/incidents', {
      ...rest,
      ...(state_id ? { state: state_id } : {}),
      ...(severity_id ? { severity: severity_id } : {}),
    })
  },

  update: (id: string, data: Partial<Incident> & { state_id?: string; severity_id?: string }) => {
    const { state_id, severity_id, ...rest } = data
    return client.put<Incident>(`/incidents/${id}`, {
      ...rest,
      ...(state_id ? { state: state_id } : {}),
      ...(severity_id ? { severity: severity_id } : {}),
    })
  },

  delete: (id: string) =>
    client.delete(`/incidents/${id}`),

  acknowledge: (id: string) =>
    client.post(`/incidents/${id}/acknowledge`),

  resolve: (id: string) =>
    client.post(`/incidents/${id}/resolve`),

  assign: (id: string, user_id: string) =>
    client.post(`/incidents/${id}/assign`, { user_id }),

  notes: (id: string) =>
    client.get<IncidentNote[] | PaginatedResponse<IncidentNote>>(`/incidents/${id}/notes`),

  addNote: (id: string, content: string, is_internal = false) =>
    client.post<IncidentNote>(`/incidents/${id}/notes`, {
      content,
      is_public: !is_internal,
    }),

  timeline: {
    list: (id: string) =>
      client.get<{ timeline: TimelineEntry[] }>(`/incidents/${id}/timeline`),
    add: (id: string, message: string) =>
      client.post<TimelineEntry>(`/incidents/${id}/timeline`, { message }),
  },

  postmortem: {
    get: (id: string) =>
      client.get<Postmortem>(`/incidents/${id}/postmortem`),
    save: (id: string, data: Partial<Postmortem> & { published?: boolean }) => {
      const { published, ...rest } = data
      return client.post<Postmortem>(`/incidents/${id}/postmortem`, {
        ...rest,
        publish: published ?? false,
      })
    },
  },

  states: {
    list: () =>
      client.get<PaginatedResponse<IncidentState>>('/incident-states'),
    create: (data: { name: string; color: string; order?: number }) =>
      client.post<IncidentState>('/incident-states', data),
    update: (id: string, data: Partial<IncidentState>) =>
      client.put<IncidentState>(`/incident-states/${id}`, data),
    delete: (id: string) =>
      client.delete(`/incident-states/${id}`),
  },

  severities: {
    list: () =>
      client.get<PaginatedResponse<IncidentSeverityObj>>('/incident-severities'),
    create: (data: { name: string; color: string; order?: number }) =>
      client.post<IncidentSeverityObj>('/incident-severities', data),
    update: (id: string, data: Partial<IncidentSeverityObj>) =>
      client.put<IncidentSeverityObj>(`/incident-severities/${id}`, data),
    delete: (id: string) =>
      client.delete(`/incident-severities/${id}`),
  },
}
