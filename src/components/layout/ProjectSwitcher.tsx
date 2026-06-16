import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { projectsApi } from '@/api/projects'
import { authStore } from '@/store/auth'
import { useProjectSwitch } from '@/hooks/useProjectSwitch'
import { IconFolder, IconChevronDown } from '@/components/ui/Icons'

interface ProjectSwitcherProps {
  collapsed?: boolean
}

export default function ProjectSwitcher({ collapsed = false }: ProjectSwitcherProps) {
  const switchProject = useProjectSwitch()
  const [open, setOpen] = useState(false)
  const [, setRevision] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  const currentId = authStore.getProjectId()
  const currentName = authStore.getProjectName() || 'Projet'

  const { data: projects = [] } = useQuery({
    queryKey: ['projects', 'switcher'],
    queryFn: () => projectsApi.listAll({ active: true }),
  })

  useEffect(() => {
    const onChange = () => setRevision(r => r + 1)
    window.addEventListener('project-context-changed', onChange)
    return () => window.removeEventListener('project-context-changed', onChange)
  }, [])

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const dropdown = open && (
    <div className={`absolute z-50 bg-[#1c1a2e] border border-white/10 rounded-lg shadow-xl overflow-hidden ${
      collapsed ? 'left-full top-0 ml-2 w-52' : 'left-2.5 right-2.5 top-full mt-1'
    }`}>
      <div className="max-h-52 overflow-y-auto py-1">
        {projects.length === 0 ? (
          <p className="px-3 py-2 text-xs text-slate-400">Aucun projet actif</p>
        ) : (
          projects.map(p => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                if (p.id !== currentId) {
                  switchProject(p.id, p.name, p.slug)
                }
                setOpen(false)
              }}
              className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                p.id === currentId
                  ? 'bg-brand-600/20 text-white'
                  : 'text-slate-300 hover:bg-white/5 hover:text-white'
              }`}
            >
              <span className="block truncate font-medium">{p.name}</span>
              <span className="block truncate text-[10px] text-slate-500 font-mono">{p.slug}</span>
            </button>
          ))
        )}
      </div>
      <div className="border-t border-white/8 px-3 py-2">
        <Link
          to="/settings?tab=projects"
          onClick={() => setOpen(false)}
          className="text-xs text-brand-400 hover:text-brand-300 transition-colors"
        >
          Gérer les projets →
        </Link>
      </div>
    </div>
  )

  if (collapsed) {
    return (
      <div ref={containerRef} className="px-2.5 mb-2 shrink-0 relative">
        <button
          type="button"
          title={currentName}
          onClick={() => setOpen(o => !o)}
          className="w-full flex justify-center p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
        >
          <IconFolder size={17} />
        </button>
        {dropdown}
      </div>
    )
  }

  return (
    <div ref={containerRef} className="px-2.5 mb-2 shrink-0 relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/8 transition-colors text-left"
      >
        <IconFolder size={15} className="text-brand-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-wide text-slate-500 leading-none mb-0.5">Projet</p>
          <p className="text-sm font-medium text-white truncate leading-tight">{currentName}</p>
        </div>
        <IconChevronDown size={14} className={`text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {dropdown}
    </div>
  )
}
