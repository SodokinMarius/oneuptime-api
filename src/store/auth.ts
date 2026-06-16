export interface AuthTenant {
  id: string
  name: string
  slug: string
}

export interface AuthProject {
  id: string
  name: string
  slug: string
}

export interface AuthUser {
  id: string
  email: string
  first_name: string
  last_name: string
  full_name?: string
  mfa_enabled?: boolean
  session_timeout_minutes?: number
  tenant?: AuthTenant | null
  default_project?: AuthProject | null
}

export const authStore = {
  getAccessToken: () => localStorage.getItem('access_token'),
  getRefreshToken: () => localStorage.getItem('refresh_token'),
  getTenantId: () => localStorage.getItem('tenant_id'),
  getProjectId: () => localStorage.getItem('project_id'),
  getProjectName: () => localStorage.getItem('project_name'),
  getProjectSlug: () => localStorage.getItem('project_slug'),

  getUser: (): AuthUser | null => {
    const raw = localStorage.getItem('user')
    return raw ? JSON.parse(raw) : null
  },

  save: (access: string, refresh: string, user: AuthUser) => {
    localStorage.setItem('access_token', access)
    localStorage.setItem('refresh_token', refresh)
    localStorage.setItem('user', JSON.stringify(user))
    if (user.tenant?.id) {
      localStorage.setItem('tenant_id', user.tenant.id)
    }
    if (user.default_project?.id) {
      localStorage.setItem('project_id', user.default_project.id)
      localStorage.setItem('project_name', user.default_project.name)
      localStorage.setItem('project_slug', user.default_project.slug)
    }
  },

  switchProject: (tenantId: string, projectId: string, projectName: string, projectSlug?: string) => {
    localStorage.setItem('tenant_id', tenantId)
    localStorage.setItem('project_id', projectId)
    localStorage.setItem('project_name', projectName)
    if (projectSlug) {
      localStorage.setItem('project_slug', projectSlug)
    }
    window.dispatchEvent(new CustomEvent('project-context-changed'))
  },

  saveContext: (tenantId: string, projectId: string, projectName?: string, projectSlug?: string) => {
    localStorage.setItem('tenant_id', tenantId)
    localStorage.setItem('project_id', projectId)
    if (projectName) localStorage.setItem('project_name', projectName)
    if (projectSlug) localStorage.setItem('project_slug', projectSlug)
  },

  clear: () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('user')
    localStorage.removeItem('tenant_id')
    localStorage.removeItem('project_id')
    localStorage.removeItem('project_name')
    localStorage.removeItem('project_slug')
  },

  isAuthenticated: () => !!localStorage.getItem('access_token'),
}
