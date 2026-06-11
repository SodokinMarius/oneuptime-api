import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { webhooksApi } from '@/api/webhooks'
import { Badge } from '@/components/ui/Badge'
import { TeamBadge } from '@/components/ui/TeamBadge'
import { formatDate } from '@/utils/format'

const statusColor: Record<string, string> = {
  success: 'bg-emerald-100 text-emerald-700',
  failed: 'bg-red-100 text-red-700',
  pending: 'bg-blue-100 text-blue-700',
  exhausted: 'bg-gray-100 text-gray-500',
}

export default function WebhookDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: webhook, isLoading } = useQuery({
    queryKey: ['webhook', id],
    queryFn: () => webhooksApi.get(id!).then(r => r.data),
    enabled: !!id,
  })

  const { data: deliveries, isLoading: loadingDeliveries } = useQuery({
    queryKey: ['webhook-deliveries', id],
    queryFn: () => webhooksApi.deliveries(id!).then(r => r.data),
    enabled: !!id,
  })

  const retryMutation = useMutation({
    mutationFn: (deliveryId: string) => webhooksApi.retry(id!, deliveryId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['webhook-deliveries', id] }),
  })

  const deleteMutation = useMutation({
    mutationFn: () => webhooksApi.delete(id!),
    onSuccess: () => navigate('/webhooks'),
  })

  if (isLoading) return (
    <div className="flex justify-center py-20">
      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!webhook) return null

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-8 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-600 mr-1">←</button>
            <h2 className="text-2xl font-bold text-gray-900">{webhook.name}</h2>
            <Badge label={webhook.is_active ? 'Actif' : 'Inactif'} />
            <TeamBadge teamId={webhook.team_id} teamName={webhook.team_name} />
          </div>
          <p className="text-sm text-gray-500 font-mono">{webhook.url}</p>
        </div>
        <button onClick={() => { if (confirm('Supprimer ce webhook ?')) deleteMutation.mutate() }}
          className="px-4 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors shrink-0">
          Supprimer
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Infos */}
        <div className="lg:col-span-1 bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h3 className="text-sm font-semibold text-gray-700">Informations</h3>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Créé le</p>
            <p className="text-sm text-gray-700">{formatDate(webhook.created_at)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Événements ({webhook.event_types.length})</p>
            <div className="flex flex-wrap gap-1">
              {webhook.event_types.map(ev => (
                <span key={ev} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-mono">{ev}</span>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Secret</p>
            <p className="text-sm text-gray-700 font-mono">{webhook.secret ? '••••••••' : '—'}</p>
          </div>
        </div>

        {/* Deliveries */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Historique des envois (100 derniers)</h3>
          {loadingDeliveries ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !deliveries || deliveries.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Aucun envoi pour l'instant.</p>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {deliveries.map(d => (
                <div key={d.id} className="flex items-start justify-between py-2 border-b border-gray-50 last:border-0 gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColor[d.status] ?? 'bg-gray-100 text-gray-500'}`}>
                        {d.status}
                      </span>
                      <span className="text-xs text-gray-500 font-mono">{d.event}</span>
                    </div>
                    <p className="text-xs text-gray-400">
                      {d.response_status ? `HTTP ${d.response_status}` : '—'} · Tentative {d.attempt} · {formatDate(d.created_at)}
                    </p>
                  </div>
                  {(d.status === 'failed' || d.status === 'exhausted') && (
                    <button onClick={() => retryMutation.mutate(d.id)}
                      disabled={retryMutation.isPending}
                      className="text-xs text-blue-600 hover:underline shrink-0 disabled:opacity-50">
                      Réessayer
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
