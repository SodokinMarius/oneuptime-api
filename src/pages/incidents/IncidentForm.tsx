import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { incidentsApi } from '@/api/incidents'
import { TeamSelect } from '@/components/ui/TeamSelect'
import { teamIdPayload } from '@/utils/teamParams'

interface Props { onSuccess: () => void }

export default function IncidentForm({ onSuccess }: Props) {
  const [teamId, setTeamId] = useState('')
  const [form, setForm] = useState({ title: '', description: '', state_id: '', severity_id: '' })
  const [error, setError] = useState('')

  const { data: states } = useQuery({
    queryKey: ['incident-states'],
    queryFn: () => incidentsApi.states.list().then(r => r.data.results),
  })
  const { data: severities } = useQuery({
    queryKey: ['incident-severities'],
    queryFn: () => incidentsApi.severities.list().then(r => r.data.results),
  })

  const mut = useMutation({
    mutationFn: () => incidentsApi.create({ ...form, ...teamIdPayload(teamId) }),
    onSuccess,
    onError: (err: any) => {
      const data = err.response?.data
      if (data?.errors?.length) {
        setError(data.errors.map((e: any) => e.field ? `${e.field} : ${e.message}` : e.message).join('\n'))
      } else if (data?.detail) {
        setError(data.detail)
      } else if (typeof data === 'object') {
        setError(Object.entries(data).map(([k, v]) => `${k} : ${Array.isArray(v) ? v.join(', ') : v}`).join('\n'))
      } else {
        setError('Une erreur est survenue.')
      }
    },
  })

  return (
    <form onSubmit={e => { e.preventDefault(); setError(''); mut.mutate() }} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Titre *</label>
        <input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="API de paiement inaccessible" />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <textarea rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          placeholder="Décrivez le problème..." />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Sévérité</label>
          <select value={form.severity_id} onChange={e => setForm({ ...form, severity_id: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Sélectionner...</option>
            {severities?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">État initial</label>
          <select value={form.state_id} onChange={e => setForm({ ...form, state_id: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Sélectionner...</option>
            {states?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </div>

      <TeamSelect value={teamId} onChange={setTeamId} />

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 whitespace-pre-line">{error}</div>}

      <div className="flex justify-end pt-1">
        <button type="submit" disabled={mut.isPending}
          className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-medium px-5 py-2 rounded-lg text-sm transition-colors">
          {mut.isPending ? 'Création...' : 'Déclarer l\'incident'}
        </button>
      </div>
    </form>
  )
}
