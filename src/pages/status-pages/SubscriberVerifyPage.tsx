import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { statusPagesApi } from '@/api/statusPages'
import { IconCheckCircle, IconAlertCircle } from '@/components/ui/Icons'

type VerifyType = 'email' | 'phone'

const COPY: Record<VerifyType, { title: string; success: string; pending: string }> = {
  email: {
    title: 'Verify your email',
    success: 'Your email is verified. You will receive status updates by email.',
    pending: 'Confirming your email subscription…',
  },
  phone: {
    title: 'Verify your phone',
    success: 'Your phone is verified. You will receive SMS alerts when configured.',
    pending: 'Confirming your phone for SMS alerts…',
  },
}

export default function SubscriberVerifyPage({ type }: { type: VerifyType }) {
  const { slug } = useParams<{ slug: string }>()
  const [searchParams] = useSearchParams()
  const tokenFromUrl = searchParams.get('token') ?? ''

  const [token, setToken] = useState(tokenFromUrl)
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>(
    tokenFromUrl ? 'loading' : 'idle',
  )
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const verify = async (value: string) => {
    if (!slug || !value.trim()) return
    setStatus('loading')
    setSubmitting(true)
    setMessage('')
    try {
      const fn = type === 'email' ? statusPagesApi.verifyEmail : statusPagesApi.verifyPhone
      const { data } = await fn(slug, value.trim())
      setStatus('success')
      setMessage(data.detail || COPY[type].success)
    } catch (err: any) {
      setStatus('error')
      const d = err.response?.data
      const tokenErr = d?.token
      setMessage(
        (Array.isArray(tokenErr) ? tokenErr[0] : tokenErr)
        || d?.errors?.[0]?.message
        || d?.detail
        || 'Invalid or expired verification link.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  useEffect(() => {
    if (tokenFromUrl) verify(tokenFromUrl)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, tokenFromUrl, type])

  const labels = COPY[type]

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-xl border border-gray-200 shadow-sm p-8">
        <h1 className="text-xl font-semibold text-gray-900 mb-2">{labels.title}</h1>

        {status === 'loading' && (
          <div className="flex items-center gap-3 text-sm text-gray-500 py-4">
            <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin shrink-0" />
            {labels.pending}
          </div>
        )}

        {status === 'success' && (
          <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-lg px-4 py-3 mb-4">
            <IconCheckCircle size={18} className="shrink-0 mt-0.5" />
            <p>{message}</p>
          </div>
        )}

        {status === 'error' && (
          <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">
            <IconAlertCircle size={18} className="shrink-0 mt-0.5" />
            <p>{message}</p>
          </div>
        )}

        {(status === 'idle' || status === 'error') && !tokenFromUrl && (
          <form
            onSubmit={e => { e.preventDefault(); verify(token) }}
            className="space-y-4 mt-4"
          >
            <div>
              <label className="label">Verification token</label>
              <input
                required
                value={token}
                onChange={e => setToken(e.target.value)}
                className="input-field font-mono text-sm"
                placeholder="Paste the token from your email or SMS"
              />
            </div>
            <button
              type="submit"
              disabled={submitting || !token.trim()}
              className="btn-primary w-full disabled:opacity-50"
            >
              {submitting ? 'Verifying…' : 'Verify'}
            </button>
          </form>
        )}

        {slug && (
          <p className="text-center text-sm text-gray-500 mt-6">
            <Link to={`/status/${slug}`} className="text-brand-600 hover:text-brand-700 font-medium">
              ← Back to status page
            </Link>
          </p>
        )}
      </div>
    </div>
  )
}
