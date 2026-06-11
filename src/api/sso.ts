import axios from 'axios'
import client from './client'
import { API_BASE_URL } from '@/config/api'

export type SSOProvider = 'okta' | 'azure_ad' | 'google' | 'custom'

export interface SPMetadata {
  entity_id: string
  acs_url: string
  slo_url: string
  metadata_url: string
  certificate: string
}

export interface SSOConfig {
  id: string
  provider: SSOProvider
  name: string
  description: string
  entity_id: string
  sso_url: string
  slo_url: string
  x509_cert?: string
  attribute_map: Record<string, string>
  jit_enabled: boolean
  default_role_id: string | null
  default_team_ids: string[]
  enforce_sso: boolean
  scim_auto_provision: boolean
  scim_auto_deprovision: boolean
  scim_enable_push_groups: boolean
  is_enabled: boolean
  sp_metadata?: SPMetadata
  scim_token?: string
  scim_token_prefix?: string
  created_at: string
  updated_at: string
}

export interface SSODiscoverConfig {
  project_id: string
  project_name: string
  provider: SSOProvider
  name: string
  login_url: string
  sp_entity_id: string
}

export interface SCIMSyncLog {
  id: string
  operation: string
  resource: string
  external_id: string
  status: string
  error_message: string
  created_at: string
}

/** Public SSO discover (no auth) — used on login page */
export const ssoPublicApi = {
  discover: (email: string) =>
    axios.get<{ email: string; sso_configs: SSODiscoverConfig[] }>(
      `${API_BASE_URL}/sso/discover/`,
      { params: { email } },
    ),

  loginUrl: (projectId: string) => `${API_BASE_URL}/sso/login/${projectId}/`,
}

export const ssoApi = {
  list: () =>
    client.get<{ results: SSOConfig[] }>('/sso/config'),

  get: (id: string) =>
    client.get<SSOConfig>(`/sso/config/${id}`),

  create: (data: Partial<SSOConfig> & {
    name: string
    entity_id: string
    sso_url: string
    x509_cert: string
    default_role_id: string
    default_team_ids: string[]
  }) =>
    client.post<SSOConfig & { scim_token: string }>('/sso/config', data),

  update: (id: string, data: Partial<SSOConfig>) =>
    client.patch<SSOConfig>(`/sso/config/${id}`, data),

  delete: (id: string) =>
    client.delete(`/sso/config/${id}`),

  regenerateScimToken: (id: string) =>
    client.post<{ scim_token: string }>(`/sso/config/${id}/regenerate-scim-token`),

  scimLogs: (id: string) =>
    client.get<SCIMSyncLog[]>(`/sso/config/${id}/scim-logs`),

  providerPresets: () =>
    client.get<Record<SSOProvider, { attribute_map: Record<string, string> }>>(
      '/sso/config/provider-presets',
    ),

  metadataUrl: (projectId: string) =>
    `${API_BASE_URL}/sso/metadata/${projectId}/`,
}
