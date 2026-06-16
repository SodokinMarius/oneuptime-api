import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { monitorsApi } from '@/api/monitors'
import { TeamSelect } from '@/components/ui/TeamSelect'
import type { MonitorType } from '@/types'
import { teamIdPayload } from '@/utils/teamParams'

interface Props { onSuccess: () => void }

export default function MonitorForm({ onSuccess }: Props) {
  const [teamId, setTeamId] = useState('')
  const [form, setForm] = useState({
    name: '', type: 'website' as MonitorType, url: '',
    method: 'GET', interval_seconds: 60, timeout_seconds: 30, retries: 3,
    alert_on_failure: true,
  })
  const [error, setError] = useState('')

  const mut = useMutation({
    mutationFn: () => monitorsApi.create({ ...form, ...teamIdPayload(teamId) }),
    onSuccess,
    onError: (err: any) => {
      const data = err.response?.data
      if (data?.errors?.length) {
        const msgs = data.errors.map((e: any) =>
          e.field ? `${e.field} : ${e.message}` : e.message
        ).join('\n')
        setError(msgs)
      } else if (data?.detail) {
        setError(data.detail)
      } else if (typeof data === 'object') {
        const msgs = Object.entries(data).map(([k, v]) => `${k} : ${Array.isArray(v) ? v.join(', ') : v}`).join('\n')
        setError(msgs)
      } else {
        setError('Une erreur est survenue.')
      }
    },
  })

  const needsUrl = ['api', 'website', 'tcp'].includes(form.type)

  return (
    <form onSubmit={e => { e.preventDefault(); setError(''); mut.mutate() }} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="label">Nom *</label>
          <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
            className="input-field"
            placeholder="Mon API de prod" />
        </div>

        <div>
          <label className="label">Type *</label>
          <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value as MonitorType })}
            className="input-field">
            <option value="website">🌐 Website</option>
            <option value="api">🔌 API</option>
            <option value="tcp">🔗 TCP</option>
            <option value="heartbeat">💓 Heartbeat</option>
          </select>
        </div>

        {form.type !== 'heartbeat' && (
          <div>
            <label className="label">Méthode HTTP</label>
            <select value={form.method} onChange={e => setForm({ ...form, method: e.target.value })}
              className="input-field">
              {['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'].map(m => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </div>
        )}

        {needsUrl && (
          <div className="col-span-2">
            <label className="label">
              {form.type === 'tcp' ? 'Cible (host:port) *' : 'URL *'}
            </label>
            <input required={needsUrl} value={form.url} onChange={e => setForm({ ...form, url: e.target.value })}
              className="input-field"
              placeholder={form.type === 'tcp' ? 'example.com:443' : 'https://example.com'} />
          </div>
        )}

        <div>
          <label className="label">Intervalle (secondes)</label>
          <input type="number" min={30} max={3600} value={form.interval_seconds}
            onChange={e => setForm({ ...form, interval_seconds: +e.target.value })}
            className="input-field" />
        </div>

        <div>
          <label className="label">Timeout (secondes)</label>
          <input type="number" min={5} max={120} value={form.timeout_seconds}
            onChange={e => setForm({ ...form, timeout_seconds: +e.target.value })}
            className="input-field" />
        </div>

        <div>
          <label className="label">Tentatives</label>
          <input type="number" min={1} max={10} value={form.retries}
            onChange={e => setForm({ ...form, retries: +e.target.value })}
            className="input-field" />
        </div>

        <div className="flex items-center gap-2 pt-6">
          <input type="checkbox" id="alert" checked={form.alert_on_failure}
            onChange={e => setForm({ ...form, alert_on_failure: e.target.checked })}
            className="rounded" />
          <label htmlFor="alert" className="text-sm text-gray-700">Alerter en cas d'échec</label>
        </div>

        <div className="col-span-2">
          <TeamSelect value={teamId} onChange={setTeamId} />
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 whitespace-pre-line">
          {error}
        </div>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <button type="submit" disabled={mut.isPending}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium px-5 py-2 rounded-lg text-sm transition-colors">
          {mut.isPending ? 'Création...' : 'Créer le monitor'}
        </button>
      </div>
    </form>
  )
}
