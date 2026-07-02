import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { statusPagesApi } from '@/api/statusPages'
import { formatDate } from '@/utils/format'
import { IconBell, IconCheckCircle } from '@/components/ui/Icons'

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  operational: { label: 'Operational', color: 'text-emerald-700', bg: 'bg-emerald-100' },
  degraded: { label: 'Degraded', color: 'text-yellow-700', bg: 'bg-yellow-100' },
  offline: { label: 'Offline', color: 'text-red-700', bg: 'bg-red-100' },
  disabled: { label: 'Disabled', color: 'text-gray-600', bg: 'bg-gray-100' },
  maintenance: { label: 'Maintenance', color: 'text-blue-700', bg: 'bg-blue-100' },
}

function statusBadge(status?: string | null) {
  const key = status ?? 'operational'
  const cfg = STATUS_LABELS[key] ?? { label: status ?? 'Unknown', color: 'text-gray-600', bg: 'bg-gray-100' }
  return (
    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${cfg.bg} ${cfg.color}`}>
      {cfg.label}
    </span>
  )
}

function SubscribeForm({ slug, accent }: { slug: string; accent: string }) {
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: () => statusPagesApi.subscribe(slug, {
      email,
      ...(phone.trim() ? { phone: phone.trim() } : {}),
    }),
    onSuccess: ({ data }) => {
      setSuccessMsg(data.detail)
      setError('')
      setEmail('')
      setPhone('')
    },
    onError: (err: any) => {
      setSuccessMsg('')
      const d = err.response?.data
      const phoneErr = d?.phone
      setError(
        (Array.isArray(phoneErr) ? phoneErr[0] : phoneErr)
        || d?.errors?.[0]?.message
        || d?.detail
        || d?.email?.[0]
        || 'Unable to subscribe. Please try again.',
      )
    },
  })

  if (successMsg) {
    return (
      <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3">
        <IconCheckCircle size={18} className="text-emerald-600 shrink-0 mt-0.5" />
        <p className="text-sm text-emerald-800">{successMsg}</p>
      </div>
    )
  }

  return (
    <form
      onSubmit={e => { e.preventDefault(); setError(''); mutation.mutate() }}
      className="space-y-4"
    >
      <div>
        <label className="label">Email address *</label>
        <input
          type="email"
          required
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="input-field"
          placeholder="you@example.com"
          autoComplete="email"
        />
      </div>
      <div>
        <label className="label">
          Phone <span className="text-gray-400 font-normal">(optional, E.164 e.g. +33612345678)</span>
        </label>
        <input
          type="tel"
          value={phone}
          onChange={e => setPhone(e.target.value)}
          className="input-field font-mono"
          placeholder="+33612345678"
          autoComplete="tel"
        />
        <p className="text-xs text-gray-400 mt-1">
          Add a phone number to receive SMS alerts during maintenance.
        </p>
      </div>
      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
      )}
      <button
        type="submit"
        disabled={mutation.isPending}
        className="w-full text-white font-medium py-2.5 px-4 rounded-lg text-sm transition-colors disabled:opacity-50"
        style={{ backgroundColor: accent }}
      >
        {mutation.isPending ? 'Subscribing…' : 'Subscribe to updates'}
      </button>
    </form>
  )
}

export default function PublicStatusPage() {
  const { slug } = useParams<{ slug: string }>()

  const { data: page, isLoading, error } = useQuery({
    queryKey: ['public-status-page', slug],
    queryFn: () => statusPagesApi.getPublic(slug!).then(r => r.data),
    enabled: !!slug,
    retry: false,
  })

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error || !page) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center max-w-md">
          <p className="text-4xl mb-3">🔍</p>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Status page not found</h1>
          <p className="text-sm text-gray-500">
            Make sure the page is <strong>public</strong> and the slug is correct.
          </p>
        </div>
      </div>
    )
  }

  const accent = page.primary_color || '#0066cc'

  return (
    <div className="min-h-screen bg-gray-50">
      {page.custom_css && <style>{page.custom_css}</style>}

      <header className="bg-white border-b border-gray-200" style={{ borderTopColor: accent, borderTopWidth: 4 }}>
        <div className="max-w-3xl mx-auto px-6 py-8">
          <div className="flex items-center gap-4">
            {page.logo_url && (
              <img src={page.logo_url} alt="" className="h-10 w-auto object-contain" />
            )}
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{page.name}</h1>
              {page.description && <p className="text-sm text-gray-500 mt-1">{page.description}</p>}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        {page.announcements?.length > 0 && (
          <section className="space-y-3">
            {page.announcements.map(a => (
              <div key={a.id} className="bg-blue-50 border border-blue-200 rounded-xl p-5">
                <h2 className="text-sm font-semibold text-blue-900 mb-1">{a.title}</h2>
                <p className="text-sm text-blue-800 whitespace-pre-wrap">{a.content}</p>
                <p className="text-xs text-blue-600 mt-2">{formatDate(a.starts_at)}</p>
              </div>
            ))}
          </section>
        )}

        <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Service status</h2>
          </div>
          {page.resources.length === 0 ? (
            <p className="px-6 py-12 text-center text-sm text-gray-400">
              No services configured on this page.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {page.resources.map(r => {
                const label = r.display_name || r.monitor_name || r.group_name || 'Service'
                const displayStatus = r.display_status ?? r.monitor_status
                return (
                  <li key={r.id} className="px-6 py-4 flex items-center justify-between gap-4">
                    <span className="text-sm font-medium text-gray-800">{label}</span>
                    {statusBadge(displayStatus)}
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <IconBell size={18} className="text-gray-500" />
            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
              Get notified
            </h2>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            Subscribe to receive email updates when incidents or maintenance affect this page.
          </p>
          {slug && <SubscribeForm slug={slug} accent={accent} />}
        </section>

        <p className="text-center text-xs text-gray-400 pt-4">
          Powered by OneUptime
        </p>
      </main>
    </div>
  )
}
