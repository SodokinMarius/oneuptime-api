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
        : 'Une erreur est survenue.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const inputClass = "w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-950 via-[#1e1040] to-[#0f172a] flex items-center justify-center px-4 py-12">
      {/* Decorative blobs */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-brand-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-80 h-80 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-brand-500 shadow-lg shadow-brand-500/30 mb-4">
            <IconZap size={22} className="text-white" strokeWidth={2.5} />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Créer un compte</h1>
          <p className="text-slate-400 text-sm mt-1.5">Commencez à monitorer vos services</p>
        </div>

        {/* Card */}
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-8 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label text-slate-300">Prénom</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                    <IconUser size={15} />
                  </span>
                  <input
                    type="text" required
                    value={form.first_name}
                    onChange={e => setForm({ ...form, first_name: e.target.value })}
                    placeholder="Jean"
                    className={`${inputClass} pl-9`}
                  />
                </div>
              </div>
              <div>
                <label className="label text-slate-300">Nom</label>
                <input
                  type="text" required
                  value={form.last_name}
                  onChange={e => setForm({ ...form, last_name: e.target.value })}
                  placeholder="Dupont"
                  className={inputClass}
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="label text-slate-300">Adresse email</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                  <IconMail size={15} />
                </span>
                <input
                  type="email" required
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  placeholder="vous@exemple.com"
                  className={`${inputClass} pl-10`}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="label text-slate-300">Mot de passe</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                  <IconLock size={15} />
                </span>
                <input
                  type="password" required
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  placeholder="8 caractères minimum"
                  className={`${inputClass} pl-10`}
                />
              </div>
            </div>

            {/* Organisation */}
            <div>
              <label className="label text-slate-300">Organisation</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                  <IconBuilding size={15} />
                </span>
                <input
                  type="text" required
                  value={form.tenant_name}
                  onChange={e => setForm({ ...form, tenant_name: e.target.value })}
                  placeholder="Mon Organisation"
                  className={`${inputClass} pl-10`}
                />
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/20 text-red-300 text-sm rounded-lg px-4 py-3">
                <IconAlertCircle size={16} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary justify-center py-3 bg-brand-600 hover:bg-brand-500 shadow-lg shadow-brand-600/30 mt-1"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Création du compte…
                </span>
              ) : 'Créer mon compte'}
            </button>
          </form>

          <p className="text-center text-sm text-slate-400 mt-6">
            Déjà un compte ?{' '}
            <Link to="/login" className="text-brand-400 hover:text-brand-300 font-medium transition-colors">
              Se connecter
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
