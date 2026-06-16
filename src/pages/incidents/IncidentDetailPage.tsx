import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { incidentsApi, unwrapIncidentList, type TimelineEntry } from '@/api/incidents'
import { usersApi } from '@/api/users'
import { Badge } from '@/components/ui/Badge'
import { TeamBadge } from '@/components/ui/TeamBadge'
import { Modal } from '@/components/ui/Modal'
import { PageShell } from '@/components/ui/PageShell'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { Tabs } from '@/components/ui/Tabs'
import { IconChevronLeft } from '@/components/ui/Icons'
import { formatDate, formatRelative } from '@/utils/format'

type Tab = 'notes' | 'timeline' | 'postmortem'

export default function IncidentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [activeTab, setActiveTab] = useState<Tab>('notes')
  const [noteContent, setNoteContent] = useState('')
  const [noteInternal, setNoteInternal] = useState(false)
  const [timelineMsg, setTimelineMsg] = useState('')
  const [showAssign, setShowAssign] = useState(false)
  const [showPostmortem, setShowPostmortem] = useState(false)
  const [noteError, setNoteError] = useState('')
  const [timelineError, setTimelineError] = useState('')

  const { data: incident, isLoading } = useQuery({
    queryKey: ['incident', id],
    queryFn: () => incidentsApi.get(id!).then(r => r.data),
    enabled: !!id,
  })

  const { data: notesRaw, isError: notesError } = useQuery({
    queryKey: ['incident-notes', id],
    queryFn: () => incidentsApi.notes(id!).then(r => r.data),
    enabled: !!id,
  })
  const notes = notesRaw ? unwrapIncidentList(notesRaw) : undefined

  const { data: timelineResponse } = useQuery({
    queryKey: ['incident-timeline', id],
    queryFn: () => incidentsApi.timeline.list(id!).then(r => r.data),
    enabled: !!id,
  })
  const timelineEntries: TimelineEntry[] = timelineResponse?.timeline ?? []

  const { data: postmortem } = useQuery({
    queryKey: ['incident-postmortem', id],
    queryFn: () => incidentsApi.postmortem.get(id!).then(r => r.data).catch(() => null),
    enabled: !!id,
  })

  const ackMutation = useMutation({
    mutationFn: () => incidentsApi.acknowledge(id!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['incident', id] }),
  })
  const resolveMutation = useMutation({
    mutationFn: () => incidentsApi.resolve(id!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['incident', id] }),
  })
  const noteMutation = useMutation({
    mutationFn: () => incidentsApi.addNote(id!, noteContent, noteInternal),
    onSuccess: (res) => {
      qc.setQueryData(['incident-notes', id], (old: unknown) => {
        const list = old ? unwrapIncidentList(old as any) : []
        return [...list, res.data]
      })
      qc.invalidateQueries({ queryKey: ['incident-timeline', id] })
      setNoteContent('')
      setNoteError('')
    },
    onError: (err: any) => {
      setNoteError(err.response?.data?.detail || err.response?.data?.errors?.[0]?.message || 'Impossible d\'ajouter la note.')
    },
  })
  const timelineMutation = useMutation({
    mutationFn: () => incidentsApi.timeline.add(id!, timelineMsg),
    onSuccess: (res) => {
      qc.setQueryData(['incident-timeline', id], res.data)
      setTimelineMsg('')
      setTimelineError('')
    },
    onError: (err: any) => {
      setTimelineError(err.response?.data?.detail || err.response?.data?.errors?.[0]?.message || 'Impossible d\'ajouter à la timeline.')
    },
  })

  if (isLoading) return <Spinner label="Chargement…" />
  if (!incident) return null

  const isResolved = incident.is_resolved || incident.state_name === 'resolved'
  const tabs: { id: Tab; label: string }[] = [
    { id: 'notes', label: 'Notes' },
    { id: 'timeline', label: 'Timeline' },
    { id: 'postmortem', label: 'Postmortem' },
  ]

  return (
    <PageShell size="narrow">
      <button onClick={() => navigate(-1)} className="back-link">
        <IconChevronLeft size={16} />
        Retour aux incidents
      </button>

      <div className="detail-header">
        <div className="min-w-0">
          <h2 className="page-header">{incident.title}</h2>
          {incident.description && <p className="page-subtext mt-2">{incident.description}</p>}
          <div className="flex flex-wrap items-center gap-2 mt-3">
            {incident.severity_name && <Badge label={incident.severity_name} />}
            {incident.state_name && <Badge label={incident.state_name} />}
            <TeamBadge teamId={incident.team_id} teamName={incident.team_name} />
            <span className="text-xs text-gray-400">{formatRelative(incident.created_at)}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {!isResolved && (
          <>
            <Button variant="warning" onClick={() => ackMutation.mutate()} disabled={ackMutation.isPending}>
              {ackMutation.isPending ? '…' : 'Accuser réception'}
            </Button>
            <Button variant="success" onClick={() => resolveMutation.mutate()} disabled={resolveMutation.isPending}>
              {resolveMutation.isPending ? '…' : 'Résoudre'}
            </Button>
            <Button variant="secondary" onClick={() => setShowAssign(true)}>Assigner</Button>
          </>
        )}
        {isResolved && activeTab === 'postmortem' && (
          <Button onClick={() => setShowPostmortem(true)}>
            {postmortem ? 'Modifier' : 'Rédiger'} le postmortem
          </Button>
        )}
      </div>

      <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} />

      {/* Notes */}
      {activeTab === 'notes' && (
        <div className="space-y-4">
          <div className="card p-4 sm:p-5">
            <textarea value={noteContent} onChange={e => setNoteContent(e.target.value)} rows={3}
              className="input-field resize-none"
              placeholder="Ajouter une note…" />
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-3">
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                <input type="checkbox" checked={noteInternal} onChange={e => setNoteInternal(e.target.checked)}
                  className="rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
                Note interne
              </label>
              <Button onClick={() => noteMutation.mutate()} disabled={noteMutation.isPending || !noteContent.trim()}>
                {noteMutation.isPending ? 'Ajout…' : 'Ajouter'}
              </Button>
            </div>
          </div>
          {noteError && <p className="form-error">{noteError}</p>}
          {notesError && <p className="form-error">Erreur lors du chargement des notes.</p>}
          {(!notes || notes.length === 0) ? (
            <p className="text-center text-gray-400 py-8 text-sm">Aucune note pour l'instant.</p>
          ) : (
            <div className="space-y-3">
              {notes.map(note => {
                const isInternal = note.is_internal ?? !note.is_public
                const authorLabel = note.author?.full_name || note.author?.email || note.author_email || 'Utilisateur'
                return (
                <div key={note.id} className={`rounded-xl p-4 ${isInternal ? 'bg-yellow-50 border border-yellow-200' : 'bg-white border border-gray-200'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">{authorLabel}</span>
                    <div className="flex items-center gap-2">
                      {isInternal && <span className="text-xs text-yellow-600 bg-yellow-100 px-2 py-0.5 rounded-full">Interne</span>}
                      <span className="text-xs text-gray-400">{formatRelative(note.created_at)}</span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{note.content}</p>
                </div>
              )})}
            </div>
          )}
        </div>
      )}

      {/* Timeline */}
      {activeTab === 'timeline' && (
        <div className="space-y-4">
          <div className="card p-4 sm:p-5 flex flex-col sm:flex-row gap-3">
            <input value={timelineMsg} onChange={e => setTimelineMsg(e.target.value)}
              className="input-field flex-1"
              placeholder="Ajouter une entrée à la timeline…" />
            <Button onClick={() => timelineMutation.mutate()} disabled={timelineMutation.isPending || !timelineMsg.trim()} className="shrink-0">
              {timelineMutation.isPending ? '…' : 'Ajouter'}
            </Button>
          </div>
          {timelineError && <p className="form-error">{timelineError}</p>}
          {timelineEntries.length === 0 ? (
            <p className="text-center text-gray-400 py-8 text-sm">Timeline vide.</p>
          ) : (
            <div className="relative">
              <div className="absolute left-5 top-0 bottom-0 w-px bg-gray-200" />
              <div className="space-y-4">
                {timelineEntries.map((entry, idx) => {
                  const label = entry.event_type || entry.type || entry.action || 'event'
                  const message = entry.message || entry.content || entry.action || '—'
                  const when = entry.created_at || entry.at || ''
                  return (
                  <div key={entry.id ?? `${label}-${when}-${idx}`} className="flex items-start gap-4 pl-12 relative">
                    <div className="absolute left-3.5 top-1.5 w-3 h-3 rounded-full bg-blue-500 border-2 border-white shadow-sm" />
                    <div className="flex-1 bg-white rounded-xl border border-gray-200 p-4">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-400 font-mono bg-gray-50 px-2 py-0.5 rounded">{label}</span>
                        <span className="text-xs text-gray-400">{when ? formatDate(when) : ''}</span>
                      </div>
                      <p className="text-sm text-gray-700">{message}</p>
                      {entry.actor && <p className="text-xs text-gray-400 mt-1">par {entry.actor.full_name}</p>}
                    </div>
                  </div>
                )})}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Postmortem */}
      {activeTab === 'postmortem' && (
        <div>
          {!postmortem ? (
            <div className="text-center py-16">
              <p className="text-4xl mb-3">📋</p>
              <p className="text-base font-medium text-gray-800 mb-1">Aucun postmortem rédigé</p>
              <p className="text-sm text-gray-500 mb-6">Documentez les causes racines et les actions correctives.</p>
              <button onClick={() => setShowPostmortem(true)}
                className="btn-primary">
                Rédiger le postmortem
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold text-gray-900">Postmortem</h3>
                  {postmortem.published && <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">Publié</span>}
                </div>
                <button onClick={() => setShowPostmortem(true)}
                  className="text-sm text-blue-600 hover:underline">Modifier</button>
              </div>
              {[
                { label: 'Résumé', value: postmortem.summary },
                { label: 'Cause racine', value: postmortem.root_cause },
                { label: 'Impact', value: postmortem.impact },
                { label: 'Timeline', value: postmortem.timeline },
                {
                  label: 'Actions correctives',
                  value: Array.isArray(postmortem.action_items)
                    ? postmortem.action_items.join('\n')
                    : postmortem.action_items,
                },
              ].filter(field => field.value).map(field => (
                <div key={field.label}>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{field.label}</h4>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{field.value}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Assign Modal */}
      <Modal open={showAssign} onClose={() => setShowAssign(false)} title="Assigner l'incident" size="sm">
        <AssignForm incidentId={id!} onClose={() => setShowAssign(false)} />
      </Modal>

      {/* Postmortem Modal */}
      <Modal open={showPostmortem} onClose={() => setShowPostmortem(false)} title="Postmortem" size="lg">
        <PostmortemForm incidentId={id!} existing={postmortem} onClose={() => setShowPostmortem(false)} />
      </Modal>
    </PageShell>
  )
}

function AssignForm({ incidentId, onClose }: { incidentId: string; onClose: () => void }) {
  const qc = useQueryClient()
  const [userId, setUserId] = useState('')
  const [error, setError] = useState('')

  const { data } = useQuery({
    queryKey: ['users-list'],
    queryFn: () => usersApi.list().then(r => r.data),
  })

  const mutation = useMutation({
    mutationFn: () => incidentsApi.assign(incidentId, userId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['incident', incidentId] }); onClose() },
    onError: (err: any) => setError(err.response?.data?.detail || 'Erreur.'),
  })

  return (
    <div className="space-y-4">
      <div>
        <label className="label">Assigner à</label>
        <select value={userId} onChange={e => setUserId(e.target.value)}
          className="input-field">
          <option value="">Sélectionner un utilisateur...</option>
          {data?.results?.map(u => <option key={u.id} value={u.id}>{u.full_name || u.email}</option>)}
        </select>
      </div>
      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
      <div className="form-actions">
        <button onClick={onClose} className="btn-ghost">Annuler</button>
        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !userId}>
          {mutation.isPending ? 'Assignation…' : 'Assigner'}
        </Button>
      </div>
    </div>
  )
}

function PostmortemForm({ incidentId, existing, onClose }: { incidentId: string; existing: any; onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    summary: existing?.summary ?? '',
    root_cause: existing?.root_cause ?? '',
    impact: existing?.impact ?? '',
    timeline: existing?.timeline ?? '',
    action_items: existing?.action_items ?? '',
    published: existing?.published ?? false,
  })
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: () => incidentsApi.postmortem.save(incidentId, form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['incident-postmortem', incidentId] })
      onClose()
    },
    onError: (err: any) => setError(err.response?.data?.detail || err.response?.data?.errors?.[0]?.message || 'Erreur lors de l\'enregistrement.'),
  })

  const fields = [
    { key: 'summary', label: 'Résumé', placeholder: 'Résumé concis de l\'incident...' },
    { key: 'root_cause', label: 'Cause racine', placeholder: 'Qu\'est-ce qui a causé l\'incident ?' },
    { key: 'impact', label: 'Impact', placeholder: 'Quels services ou utilisateurs ont été affectés ?' },
    { key: 'timeline', label: 'Timeline', placeholder: 'Chronologie des événements...' },
    { key: 'action_items', label: 'Actions correctives', placeholder: 'Mesures préventives à prendre...' },
  ] as const

  return (
    <div className="space-y-4">
      {fields.map(f => (
        <div key={f.key}>
          <label className="label">{f.label}</label>
          <textarea value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} rows={3}
            className="input-field resize-none"
            placeholder={f.placeholder} />
        </div>
      ))}
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={form.published} onChange={e => setForm(p => ({ ...p, published: e.target.checked }))}
          className="rounded border-gray-300 text-blue-600" />
        <span className="text-sm text-gray-700 font-medium">Publier le postmortem</span>
      </label>
      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
      <div className="form-actions">
        <button onClick={onClose} className="btn-ghost">Annuler</button>
        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          {mutation.isPending ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
      </div>
    </div>
  )
}
