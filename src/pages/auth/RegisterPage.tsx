import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { authApi } from '@/api/auth'
import { IconMail, IconLock, IconUser, IconBuilding, IconZap, IconAlertCircle } from '@/components/ui/Icons'

export default function RegisterPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    tenant_name: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await authApi.register(form)
      navigate('/activate', { state: { email: form.email } })
    } catch (err: any) {
      const data = err.response?.data
      const msg = typeof data === 'object'
        ? Object.values(data).flat().join(' ')
        : 'An error occurred.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const inputClass = "input-field"

  return (
    <div className="min-h-screen bg-slate-50 flex">
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
            Get started in minutes
          </h2>
          <p className="mt-4 text-brand-100 text-base max-w-sm leading-relaxed">
            Create your workspace and start monitoring HTTP, TCP, SSL, and more from a single platform.
          </p>
        </div>
        <p className="relative text-sm text-brand-200">Self-hosted · Open source · Enterprise-ready</p>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-brand-600 shadow-lg mb-4">
              <IconZap size={22} className="text-white" strokeWidth={2.5} />
            </div>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Create an account</h1>
            <p className="text-slate-500 text-sm mt-1">Start monitoring your services today</p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">First name</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                    <IconUser size={15} />
                  </span>
                  <input
                    type="text" required
                    value={form.first_name}
                    onChange={e => setForm({ ...form, first_name: e.target.value })}
                    placeholder="John"
                    className={`${inputClass} pl-9`}
                  />
                </div>
              </div>
              <div>
                <label className="label">Last name</label>
                <input
                  type="text" required
                  value={form.last_name}
                  onChange={e => setForm({ ...form, last_name: e.target.value })}
                  placeholder="Doe"
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <label className="label">Email address</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                  <IconMail size={15} />
                </span>
                <input
                  type="email" required
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  placeholder="you@example.com"
                  className={`${inputClass} pl-10`}
                />
              </div>
            </div>

            <div>
              <label className="label">Password</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                  <IconLock size={15} />
                </span>
                <input
                  type="password" required
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  placeholder="At least 8 characters"
                  className={`${inputClass} pl-10`}
                />
              </div>
            </div>

            <div>
              <label className="label">Organization</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                  <IconBuilding size={15} />
                </span>
                <input
                  type="text" required
                  value={form.tenant_name}
                  onChange={e => setForm({ ...form, tenant_name: e.target.value })}
                  placeholder="My Organization"
                  className={`${inputClass} pl-10`}
                />
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
                  Creating account…
                </span>
              ) : 'Get started'}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-brand-600 hover:text-brand-700 font-medium transition-colors">
              Sign in
            </Link>
          </p>
          </div>
        </div>
      </div>
    </div>
  )
}
