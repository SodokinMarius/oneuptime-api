import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { webhooksApi } from '@/api/webhooks'
import { Badge } from '@/components/ui/Badge'
import { TeamBadge } from '@/components/ui/TeamBadge'
import { PageShell } from '@/components/ui/PageShell'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { IconChevronLeft } from '@/components/ui/Icons'
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

  if (isLoading) return <Spinner label="Chargement…" />

  if (!webhook) return null

  return (
    <PageShell size="narrow">
      <button onClick={() => navigate(-1)} className="back-link">
        <IconChevronLeft size={16} />
        Retour aux webhooks
      </button>

      <div className="detail-header">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h2 className="page-header">{webhook.name}</h2>
            <Badge label={webhook.is_active ? 'Actif' : 'Inactif'} />
            <TeamBadge teamId={webhook.team_id} teamName={webhook.team_name} />
          </div>
          <p className="text-sm text-gray-500 font-mono break-all">{webhook.url}</p>
        </div>
        <Button variant="danger" onClick={() => { if (confirm('Supprimer ce webhook ?')) deleteMutation.mutate() }}>
          Supprimer
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 mb-8">
        <div className="lg:col-span-1 card p-4 sm:p-5 space-y-4">
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
        <div className="lg:col-span-2 card p-4 sm:p-5">
          <h3 className="section-title mb-4">Historique des envois (100 derniers)</h3>
          {loadingDeliveries ? (
            <Spinner size="sm" />
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
                      className="btn-ghost btn-sm text-brand-600 shrink-0 disabled:opacity-50">
                      Réessayer
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </PageShell>
  )
}
