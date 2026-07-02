import { useEffect, useState } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { authApi } from '@/api/auth'
import { ssoPublicApi, type SSODiscoverConfig } from '@/api/sso'
import { authStore } from '@/store/auth'
import { IconMail, IconLock, IconZap, IconAlertCircle, IconShieldCheck } from '@/components/ui/Icons'

export default function LoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [ssoLoading, setSsoLoading] = useState(false)
  const [ssoConfigs, setSsoConfigs] = useState<SSODiscoverConfig[] | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    if (searchParams.get('sso_required')) {
      setError('This organization requires SSO. Use the "Continue with SSO" button.')
    }
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await authApi.login(form)
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
      const data = err.response?.data
      if (data?.sso_required) {
        setError('Your organization requires SSO. Use the button below.')
        return
      }
      const errors = data?.errors
      const msg = errors?.[0]?.message || data?.detail || 'Incorrect email or password.'
      setError(msg.includes('activate')
        ? 'Account not activated. Check your email.'
        : msg
      )
    } finally {
      setLoading(false)
    }
  }

  const handleSsoDiscover = async () => {
    if (!form.email) {
      setError('Enter your email to discover SSO options.')
      return
    }
    setError('')
    setSsoLoading(true)
    setSsoConfigs(null)
    try {
      const { data } = await ssoPublicApi.discover(form.email)
      if (!data.sso_configs.length) {
        setError('No SSO configuration found for this email.')
        return
      }
      if (data.sso_configs.length === 1) {
        window.location.href = ssoPublicApi.loginUrl(data.sso_configs[0].project_id)
        return
      }
      setSsoConfigs(data.sso_configs)
    } catch {
      setError('Unable to reach the SSO server.')
    } finally {
      setSsoLoading(false)
    }
  }

  const startSso = (projectId: string) => {
    window.location.href = ssoPublicApi.loginUrl(projectId)
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Left panel — brand (OneUptime marketing style) */}
      <div className="hidden lg:flex lg:w-[45%] xl:w-[42%] bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900 text-white flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(255,255,255,0.12)_0%,_transparent_50%)]" />
        <div className="relative">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center backdrop-blur">
              <IconZap size={20} className="text-white" strokeWidth={2.5} />
            </div>
            <span className="text-lg font-bold tracking-tight">OneUptime</span>
          </div>
          <h2 className="text-3xl xl:text-4xl font-bold leading-tight tracking-tight max-w-md">
            The open-source observability platform
          </h2>
          <p className="mt-4 text-brand-100 text-base max-w-sm leading-relaxed">
            Monitoring, incidents, status pages, and maintenance — unified in one reliability stack.
          </p>
        </div>
        <ul className="relative space-y-3 text-sm text-brand-100">
          {['Real-time monitoring', 'Incident management', 'Public status pages', 'Scheduled maintenance'].map(item => (
            <li key={item} className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              {item}
            </li>
          ))}
        </ul>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-brand-600 shadow-lg mb-4">
              <IconZap size={22} className="text-white" strokeWidth={2.5} />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">OneUptime</h1>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight hidden lg:block">Sign in</h1>
            <p className="text-slate-500 text-sm mt-1">Welcome back. Sign in to your workspace.</p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="label">Email address</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                  <IconMail size={16} />
                </span>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="you@example.com"
                  className="input-field pl-10"
                />
              </div>
            </div>

            <div>
              <label className="label">Password</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                  <IconLock size={16} />
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="••••••••"
                  className="input-field pl-10 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors text-xs font-medium"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2.5 form-error">
                <IconAlertCircle size={16} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary justify-center py-3 mt-1"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in…
                </span>
              ) : 'Sign in'}
            </button>

            <div className="relative my-2">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200" /></div>
              <div className="relative flex justify-center text-xs"><span className="bg-white px-2 text-slate-400">or</span></div>
            </div>

            <button
              type="button"
              onClick={handleSsoDiscover}
              disabled={ssoLoading}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 hover:bg-slate-100 transition-colors"
            >
              {ssoLoading ? (
                <span className="w-4 h-4 border-2 border-slate-300 border-t-brand-600 rounded-full animate-spin" />
              ) : (
                <IconShieldCheck size={16} />
              )}
              Continue with SSO
            </button>

            {ssoConfigs && ssoConfigs.length > 1 && (
              <div className="space-y-2 pt-1">
                <p className="text-xs text-slate-500 text-center">Choose your organization:</p>
                {ssoConfigs.map(cfg => (
                  <button
                    key={cfg.project_id}
                    type="button"
                    onClick={() => startSso(cfg.project_id)}
                    className="w-full text-left px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 hover:bg-slate-100"
                  >
                    <span className="font-medium">{cfg.project_name}</span>
                    <span className="text-slate-400 text-xs ml-2">{cfg.name}</span>
                  </button>
                ))}
              </div>
            )}
          </form>

          <p className="text-center text-sm text-slate-500 mt-6">
            Don't have an account yet?{' '}
            <Link to="/register" className="text-brand-600 hover:text-brand-700 font-medium transition-colors">
              Get started
            </Link>
          </p>
          </div>
        </div>
      </div>
    </div>
  )
}
