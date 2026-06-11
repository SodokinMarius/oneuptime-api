import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { authApi } from '@/api/auth'
import { authStore } from '@/store/auth'
import { IconZap, IconAlertCircle } from '@/components/ui/Icons'

/**
 * Handles redirect from SAML ACS after successful IdP authentication.
 * Tokens are passed as query params by the backend (browser SAML flow).
 */
export default function SSOCallbackPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [error, setError] = useState('')

  useEffect(() => {
    const err = params.get('error')
    if (err) {
      setError(decodeURIComponent(err))
      return
    }

    const access = params.get('access')
    const refresh = params.get('refresh')
    const projectId = params.get('project_id')

    if (!access || !refresh) {
      setError('Réponse SSO incomplète. Réessayez depuis la page de connexion.')
      return
    }

    const finish = async () => {
      try {
        // Store tokens before /me call (interceptor needs them)
        localStorage.setItem('access_token', access)
        localStorage.setItem('refresh_token', refresh)
        if (projectId) {
          localStorage.setItem('project_id', projectId)
        }

        const { data: me } = await authApi.me()
        authStore.save(access, refresh, me)
        if (me.tenant?.id && (projectId || me.default_project?.id)) {
          authStore.saveContext(
            me.tenant.id,
            projectId || me.default_project!.id,
          )
        }
        navigate('/dashboard', { replace: true })
      } catch {
        authStore.clear()
        setError('Impossible de finaliser la connexion SSO. Contactez votre administrateur.')
      }
    }

    finish()
  }, [params, navigate])

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-950 via-[#1e1040] to-[#0f172a] flex items-center justify-center px-4">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-brand-500 shadow-lg shadow-brand-500/30 mb-4">
          <IconZap size={22} className="text-white" strokeWidth={2.5} />
        </div>

        {error ? (
          <div className="max-w-md">
            <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/20 text-red-300 text-sm rounded-lg px-4 py-3 mb-4">
              <IconAlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
            <button
              onClick={() => navigate('/login', { replace: true })}
              className="text-brand-400 hover:text-brand-300 text-sm font-medium"
            >
              Retour à la connexion
            </button>
          </div>
        ) : (
          <>
            <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4" />
            <p className="text-slate-300 text-sm">Finalisation de la connexion SSO…</p>
          </>
        )}
      </div>
    </div>
  )
}
