import client from './client'
import type { AuthUser } from '@/store/auth'

export interface LoginPayload {
  email: string
  password: string
}

export interface RegisterPayload {
  email: string
  password: string
  first_name: string
  last_name: string
  tenant_name: string
}

export interface TokenResponse {
  access: string
  refresh: string
  user: {
    id: string
    email: string
    first_name: string
    last_name: string
  }
}

export const authApi = {
  login: (payload: LoginPayload) =>
    client.post<TokenResponse>('/auth/login', payload),

  register: (payload: RegisterPayload) =>
    client.post('/auth/register', payload),

  activate: (email: string, code: string) =>
    client.post<TokenResponse>('/auth/activate', { email, code }),

  resendActivation: (email: string) =>
    client.post('/auth/resend-activation', { email }),

  logout: (refresh: string) =>
    client.post('/auth/logout', { refresh }),

  refreshToken: (refresh: string) =>
    client.post<{ access: string }>('/auth/refresh', { refresh }),

  me: () =>
    client.get<AuthUser>('/auth/me'),

  updateProfile: (data: { first_name?: string; last_name?: string; session_timeout_minutes?: number }) =>
    client.patch<AuthUser>('/auth/me', data),

  changePassword: (data: { old_password: string; new_password: string }) =>
    client.post('/auth/change-password', data),

  passwordReset: (email: string) =>
    client.post('/auth/password-reset', { email }),

  passwordResetConfirm: (data: { email: string; code: string; new_password: string }) =>
    client.post('/auth/password-reset/confirm', data),

  acceptInvite: (data: { token: string; email: string; password?: string }) =>
    client.post<TokenResponse & { tenant?: { id: string; name: string; slug: string } }>(
      '/auth/accept-invite',
      data,
    ),
}
