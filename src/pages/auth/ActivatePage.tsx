import { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { authApi } from '@/api/auth'
import { authStore } from '@/store/auth'
import { IconMail, IconZap, IconAlertCircle, IconCheckCircle, IconRefreshCw } from '@/components/ui/Icons'

export default function ActivatePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const emailFromState = (location.state as { email?: string })?.email ?? ''

  const [email, setEmail] = useState(emailFromState)
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resent, setResent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await authApi.activate(email, code)
      authStore.save(data.access, data.refresh, data.user)
      try {
        const { data: me } = await authApi.me()
        if (me.tenant?.id && me.default_project?.id) {
          authStore.saveContext(
            me.tenant.id,
            me.default_project.id,
            me.default_project.name,
            me.default_project.slug,
          )
        }
      } catch { /* non-bloquant */ }
      navigate('/dashboard')
    } catch (err: any) {
      const d = err.response?.data
      setError(d?.errors?.[0]?.message || d?.detail || 'Invalid or expired code.')
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    setError('')
    setResent(false)
    try {
      await authApi.resendActivation(email)
      setResent(true)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Unable to resend the code.')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-950 via-[#1e1040] to-[#0f172a] flex items-center justify-center px-4">
      <div className="absolute top-0 left-1/3 w-96 h-96 bg-brand-600/15 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-brand-500 shadow-lg shadow-brand-500/30 mb-4">
            <IconZap size={22} className="text-white" strokeWidth={2.5} />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Activate your account</h1>
          <p className="text-slate-400 text-sm mt-1.5">A code was sent to your email</p>
        </div>

        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-8 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="label text-slate-300">Email address</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                  <IconMail size={15} />
                </span>
                <input
                  type="email" required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div>
              <label className="label text-slate-300">Verification code</label>
              <input
                type="text" required
                value={code}
                onChange={e => setCode(e.target.value.trim())}
                maxLength={8}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-center tracking-[0.4em] text-xl font-mono text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
                placeholder="······"
              />
            </div>

            {error && (
              <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/20 text-red-300 text-sm rounded-lg px-4 py-3">
                <IconAlertCircle size={16} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {resent && (
              <div className="flex items-start gap-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm rounded-lg px-4 py-3">
                <IconCheckCircle size={16} className="shrink-0 mt-0.5" />
                <span>Code resent — check your inbox.</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary justify-center py-3 bg-brand-600 hover:bg-brand-500 shadow-lg shadow-brand-600/30"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Verifying…
                </span>
              ) : 'Activate my account'}
            </button>
          </form>

          <div className="flex items-center justify-between mt-6 text-sm">
            <button
              onClick={handleResend}
              className="text-brand-400 hover:text-brand-300 font-medium flex items-center gap-1.5 transition-colors"
            >
              <IconRefreshCw size={13} />
              Resend code
            </button>
            <Link to="/login" className="text-slate-400 hover:text-slate-300 transition-colors">
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
