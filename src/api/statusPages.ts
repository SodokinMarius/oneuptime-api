import client from './client'
import type { StatusPage, PaginatedResponse } from '@/types'

export interface StatusPageResource {
  id: string
  monitor?: { id: string; name: string; status: string }
  monitor_group?: { id: string; name: string }
  display_name: string
  order: number
}

export interface Announcement {
  id: string
  title: string
  message: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Subscriber {
  id: string
  email: string
  verified: boolean
  created_at: string
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
      client.get<StatusPageResource[]>(`/status-pages/${pageId}/resources`),
    add: (pageId: string, data: { monitor_id?: string; monitor_group_id?: string; display_name?: string }) =>
      client.post<StatusPageResource>(`/status-pages/${pageId}/resources`, data),
    remove: (pageId: string, resourceId: string) =>
      client.delete(`/status-pages/${pageId}/resources/${resourceId}`),
  },

  announcements: {
    list: (pageId: string) =>
      client.get<PaginatedResponse<Announcement>>(`/status-pages/${pageId}/announcements`),
    create: (pageId: string, data: { title: string; message: string; is_active?: boolean }) =>
      client.post<Announcement>(`/status-pages/${pageId}/announcements`, data),
  },

  subscribers: {
    list: (pageId: string) =>
      client.get<PaginatedResponse<Subscriber>>(`/status-pages/${pageId}/subscribers`),
    remove: (pageId: string, subscriberId: string) =>
      client.delete(`/status-pages/${pageId}/subscribers/${subscriberId}`),
  },

  branding: (pageId: string, data: { primary_color?: string; logo_url?: string; custom_css?: string }) =>
    client.put(`/status-pages/${pageId}/branding`, data),

  domain: (pageId: string, data: { custom_domain: string }) =>
    client.put(`/status-pages/${pageId}/domain`, data),
}
