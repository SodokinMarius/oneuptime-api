import axios from 'axios'
import client from './client'
import { API_BASE_URL } from '@/config/api'
import type { StatusPage, PaginatedResponse } from '@/types'

export interface StatusPageResource {
  id: string
  monitor?: string
  monitor_group?: string
  monitor_name?: string | null
  monitor_status?: string | null
  display_status?: string | null
  group_name?: string | null
  display_name: string
  order: number
}

export interface Announcement {
  id: string
  title: string
  content: string
  starts_at: string
  ends_at?: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Subscriber {
  id: string
  email: string
  phone: string
  is_verified: boolean
  phone_verified: boolean
  subscribed_at: string
}

export interface PublicStatusPage {
  id: string
  name: string
  slug: string
  description: string
  logo_url: string | null
  primary_color: string
  custom_css: string
  resources: StatusPageResource[]
  announcements: Announcement[]
}

/** API returns either a paginated object or a plain array depending on the endpoint. */
export function unwrapList<T>(data: PaginatedResponse<T> | T[]): T[] {
  return Array.isArray(data) ? data : data.results
}

export const statusPagesApi = {
  list: (params?: Record<string, string>) =>
    client.get<PaginatedResponse<StatusPage>>('/status-pages', { params }),

  get: (id: string) =>
    client.get<StatusPage>(`/status-pages/${id}`),

  create: (data: Partial<StatusPage>) =>
    client.post<StatusPage>('/status-pages', data),

  update: (id: string, data: Partial<StatusPage>) =>
    client.put<StatusPage>(`/status-pages/${id}`, data),

  delete: (id: string) =>
    client.delete(`/status-pages/${id}`),

  resources: {
    list: (pageId: string) =>
      client.get<StatusPageResource[] | PaginatedResponse<StatusPageResource>>(`/status-pages/${pageId}/resources`),
    add: (pageId: string, data: { monitor_id?: string; monitor_group_id?: string; display_name?: string; order?: number }) => {
      const payload: Record<string, unknown> = {}
      if (data.monitor_id) payload.monitor = data.monitor_id
      if (data.monitor_group_id) payload.monitor_group = data.monitor_group_id
      if (data.display_name) payload.display_name = data.display_name
      if (data.order != null) payload.order = data.order
      return client.post<StatusPageResource>(`/status-pages/${pageId}/resources`, payload)
    },
    remove: (pageId: string, resourceId: string) =>
      client.delete(`/status-pages/${pageId}/resources/${resourceId}`),
  },

  announcements: {
    list: (pageId: string) =>
      client.get<Announcement[] | PaginatedResponse<Announcement>>(`/status-pages/${pageId}/announcements`),
    create: (pageId: string, data: { title: string; message: string; is_active?: boolean; starts_at?: string; ends_at?: string | null }) =>
      client.post<Announcement>(`/status-pages/${pageId}/announcements`, {
        title: data.title,
        content: data.message,
        is_active: data.is_active ?? true,
        starts_at: data.starts_at ?? new Date().toISOString(),
        ...(data.ends_at != null ? { ends_at: data.ends_at } : {}),
      }),
  },

  subscribers: {
    list: (pageId: string) =>
      client.get<Subscriber[] | PaginatedResponse<Subscriber>>(`/status-pages/${pageId}/subscribers`),
    remove: (pageId: string, subscriberId: string) =>
      client.delete(`/status-pages/${pageId}/subscribers/${subscriberId}`),
  },

  branding: (pageId: string, data: { primary_color?: string; logo_url?: string; custom_css?: string }) =>
    client.put(`/status-pages/${pageId}/branding`, data),

  domain: (pageId: string, data: { custom_domain: string }) =>
    client.put(`/status-pages/${pageId}/domain`, data),

  /** Public page — no auth required */
  getPublic: (slug: string) =>
    axios.get<PublicStatusPage>(`${API_BASE_URL}/status/${slug}/`, {
      headers: { Accept: 'application/json' },
    }),

  subscribe: (slug: string, data: { email: string; phone?: string }) =>
    axios.post<{ detail: string }>(`${API_BASE_URL}/status/${slug}/subscribe/`, data, {
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    }),

  verifyEmail: (slug: string, token: string) =>
    axios.post<{ detail: string }>(
      `${API_BASE_URL}/status/${slug}/verify-email/`,
      { token },
      { headers: { Accept: 'application/json', 'Content-Type': 'application/json' } },
    ),

  verifyPhone: (slug: string, token: string) =>
    axios.post<{ detail: string }>(
      `${API_BASE_URL}/status/${slug}/verify-phone/`,
      { token },
      { headers: { Accept: 'application/json', 'Content-Type': 'application/json' } },
    ),
}
