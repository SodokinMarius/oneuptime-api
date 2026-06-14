import { useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { authApi } from '@/api/auth'
import { authStore } from '@/store/auth'
import { IconMail, IconLock, IconZap, IconAlertCircle, IconCheckCircle } from '@/components/ui/Icons'

export default function AcceptInvitePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [email, setEmail] = useState(searchParams.get('email') ?? '')
  const [token, setToken] = useState(searchParams.get('token') ?? '')
  const [password, setPassword] = useState('')
  const [needsPassword, setNeedsPassword] = useState(true)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await authApi.acceptInvite({
        token,
        email,
        password: needsPassword ? password : undefined,
      })
      authStore.save(data.access, data.refresh, data.user)
      if (data.tenant?.id) {
        try {
          const { data: me } = await authApi.me()
          if (me.default_project?.id) {
            authStore.saveContext(data.tenant.id, me.default_project.id)
          } else {
            authStore.saveContext(data.tenant.id, '')
          }
        } catch {
          authStore.saveContext(data.tenant.id, '')
        }
      }
      navigate('/dashboard')
    } catch (err: any) {
      const d = err.response?.data
      const msg = d?.errors?.[0]?.message || d?.detail || 'Invitation invalide ou expirée.'
      if (msg.toLowerCase().includes('password')) {
        setNeedsPassword(true)
      }
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const inputClass =
    'w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all'

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-950 via-[#1e1040] to-[#0f172a] flex items-center justify-center px-4">
      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-brand-500 shadow-lg shadow-brand-500/30 mb-4">
            <IconZap size={22} className="text-white" strokeWidth={2.5} />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Invitation</h1>
          <p className="text-slate-400 text-sm mt-1.5">Acceptez l'invitation à rejoindre l'organisation</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6 space-y-4 shadow-xl">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Email</label>
            <div className="relative">
              <IconMail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className={`${inputClass} pl-10`}
                placeholder="vous@exemple.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Token d'invitation</label>
            <input
              required
              value={token}
              onChange={e => setToken(e.target.value)}
              className={inputClass}
              placeholder="Token reçu par email"
            />
          </div>

          {needsPassword && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Mot de passe {needsPassword ? '*' : '(si nouveau compte)'}
              </label>
              <div className="relative">
                <IconLock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className={`${inputClass} pl-10`}
                  placeholder="Minimum 8 caractères"
                  minLength={8}
                />
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Requis si vous créez votre compte via cette invitation.
              </p>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 text-red-300 text-sm rounded-lg px-3 py-2.5">
              <IconAlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !email || !token}
            className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <IconCheckCircle size={16} />
                Accepter l'invitation
              </>
            )}
          </button>

          <p className="text-center text-sm text-slate-400">
            Déjà membre ?{' '}
            <Link to="/login" className="text-brand-400 hover:text-brand-300 font-medium">
              Se connecter
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
