import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { projectsApi, type Project } from '@/api/projects'
import { authStore } from '@/store/auth'
import { useProjectSwitch } from '@/hooks/useProjectSwitch'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'
import { IconFolder } from '@/components/ui/Icons'

function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function ProjectRow({ project }: { project: Project }) {
  const qc = useQueryClient()
  const switchProject = useProjectSwitch()
  const currentId = authStore.getProjectId()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    name: project.name,
    slug: project.slug,
    description: project.description,
  })
  const [error, setError] = useState('')

  const updateMut = useMutation({
    mutationFn: () => projectsApi.update(project.id, form),
    onSuccess: ({ data }) => {
      setEditing(false)
      qc.invalidateQueries({ queryKey: ['projects'] })
      if (currentId === project.id) {
        authStore.switchProject(
          authStore.getTenantId()!,
          data.id,
          data.name,
          data.slug,
        )
      }
    },
    onError: (err: any) => {
      const d = err.response?.data
      setError(d?.detail || d?.errors?.[0]?.message || d?.slug?.[0] || 'Erreur')
    },
  })

  const deactivateMut = useMutation({
    mutationFn: () => projectsApi.deactivate(project.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  })

  const isCurrent = project.id === currentId

  return (
    <>
      <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border rounded-xl ${
        isCurrent ? 'border-brand-200 bg-brand-50/50' : 'border-gray-200 bg-white'
      }`}>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-medium text-gray-900">{project.name}</h4>
            {isCurrent && (
              <span className="text-[10px] uppercase tracking-wide bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full font-semibold">
                Actif
              </span>
            )}
            {!project.is_active && (
              <span className="text-[10px] uppercase tracking-wide bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                Inactif
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 font-mono mt-0.5">{project.slug}</p>
          {project.description && (
            <p className="text-sm text-gray-500 mt-1">{project.description}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          {!isCurrent && project.is_active && (
            <button
              type="button"
              onClick={() => switchProject(project.id, project.name, project.slug)}
              className="text-xs border border-brand-200 text-brand-600 px-2.5 py-1 rounded-lg hover:bg-brand-50 transition-colors"
            >
              Basculer
            </button>
          )}
          <button
            type="button"
            onClick={() => { setForm({ name: project.name, slug: project.slug, description: project.description }); setEditing(true) }}
            className="text-xs border border-gray-200 text-gray-600 px-2.5 py-1 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Modifier
          </button>
          {project.is_active && (
            <button
              type="button"
              onClick={() => {
                if (confirm(`Désactiver le projet « ${project.name} » ?`)) {
                  deactivateMut.mutate()
                }
              }}
              disabled={isCurrent || deactivateMut.isPending}
              title={isCurrent ? 'Impossible de désactiver le projet actif' : undefined}
              className="text-xs border border-red-200 text-red-500 px-2.5 py-1 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Désactiver
            </button>
          )}
        </div>
      </div>

      <Modal open={editing} onClose={() => setEditing(false)} title={`Modifier — ${project.name}`} size="sm">
        <form onSubmit={e => { e.preventDefault(); setError(''); updateMut.mutate() }} className="space-y-4">
          <div>
            <label className="label">Nom *</label>
            <input
              required
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              className="input-field"
            />
          </div>
          <div>
            <label className="label">Slug *</label>
            <input
              required
              value={form.slug}
              onChange={e => setForm({ ...form, slug: e.target.value })}
              className="input-field font-mono"
            />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              className="input-field min-h-[72px]"
              rows={2}
            />
          </div>
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>}
          <div className="flex justify-end">
            <button type="submit" disabled={updateMut.isPending} className="btn-primary disabled:opacity-50">
              {updateMut.isPending ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  )
}

export default function ProjectsTab() {
  const qc = useQueryClient()
  const switchProject = useProjectSwitch()
  const [showCreate, setShowCreate] = useState(false)
  const [showInactive, setShowInactive] = useState(false)
  const [form, setForm] = useState({ name: '', slug: '', description: '' })
  const [slugTouched, setSlugTouched] = useState(false)
  const [createError, setCreateError] = useState('')

  const { data: projects, isLoading } = useQuery({
    queryKey: ['projects', showInactive],
    queryFn: () => projectsApi.listAll(showInactive ? undefined : { active: true }),
  })

  const createMut = useMutation({
    mutationFn: () => projectsApi.create({
      name: form.name,
      slug: form.slug,
      description: form.description || undefined,
    }),
    onSuccess: ({ data }) => {
      setShowCreate(false)
      setForm({ name: '', slug: '', description: '' })
      setSlugTouched(false)
      qc.invalidateQueries({ queryKey: ['projects'] })
      switchProject(data.id, data.name, data.slug)
    },
    onError: (err: any) => {
      const d = err.response?.data
      setCreateError(d?.detail || d?.errors?.[0]?.message || d?.slug?.[0] || 'Erreur')
    },
  })

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <p className="text-sm text-gray-500">{projects?.length ?? 0} projet(s)</p>
          <p className="text-xs text-gray-400 mt-0.5">
            Chaque projet isole monitors, incidents, équipes et webhooks.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-500 cursor-pointer">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={e => setShowInactive(e.target.checked)}
              className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
            />
            Afficher inactifs
          </label>
          <button type="button" onClick={() => setShowCreate(true)} className="btn-primary">
            + Nouveau projet
          </button>
        </div>
      </div>

      {!projects?.length ? (
        <EmptyState
          icon={<IconFolder size={24} />}
          title="Aucun projet"
          description="Créez un projet pour organiser votre monitoring."
        />
      ) : (
        <div className="space-y-3">
          {projects.map(p => <ProjectRow key={p.id} project={p} />)}
        </div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Nouveau projet" size="sm">
        <form
          onSubmit={e => {
            e.preventDefault()
            setCreateError('')
            createMut.mutate()
          }}
          className="space-y-4"
        >
          <div>
            <label className="label">Nom *</label>
            <input
              required
              value={form.name}
              onChange={e => {
                const name = e.target.value
                setForm(f => ({
                  ...f,
                  name,
                  slug: slugTouched ? f.slug : slugify(name),
                }))
              }}
              className="input-field"
              placeholder="Production, Staging..."
            />
          </div>
          <div>
            <label className="label">Slug *</label>
            <input
              required
              value={form.slug}
              onChange={e => { setSlugTouched(true); setForm({ ...form, slug: e.target.value }) }}
              className="input-field font-mono"
              placeholder="production"
            />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              className="input-field min-h-[72px]"
              rows={2}
              placeholder="Environnement de production client X"
            />
          </div>
          {createError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{createError}</div>
          )}
          <div className="flex justify-end">
            <button type="submit" disabled={createMut.isPending || !form.name || !form.slug} className="btn-primary disabled:opacity-50">
              {createMut.isPending ? 'Création...' : 'Créer et basculer'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
