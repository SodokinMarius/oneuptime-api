import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { projectsApi } from '@/api/projects'
import { authStore } from '@/store/auth'
import { useProjectSwitch } from '@/hooks/useProjectSwitch'
import { IconFolder, IconChevronDown } from '@/components/ui/Icons'

interface ProjectSwitcherProps {
  variant?: 'sidebar' | 'header'
  collapsed?: boolean
}

export default function ProjectSwitcher({ variant = 'sidebar', collapsed = false }: ProjectSwitcherProps) {
  const switchProject = useProjectSwitch()
  const [open, setOpen] = useState(false)
  const [, setRevision] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  const currentId = authStore.getProjectId()
  const currentName = authStore.getProjectName() || 'Project'

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
    <div className={`absolute z-50 bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden ${
      variant === 'header'
        ? 'left-0 top-full mt-1 w-64'
        : collapsed
          ? 'left-full top-0 ml-2 w-52'
          : 'left-2.5 right-2.5 top-full mt-1'
    }`}>
      <div className="max-h-52 overflow-y-auto py-1">
        {projects.length === 0 ? (
          <p className="px-3 py-2 text-xs text-slate-500">No active project</p>
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
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <span className="block truncate font-medium">{p.name}</span>
              <span className="block truncate text-[10px] text-slate-400 font-mono">{p.slug}</span>
            </button>
          ))
        )}
      </div>
      <div className="border-t border-slate-100 px-3 py-2 bg-slate-50">
        <Link
          to="/settings?tab=projects"
          onClick={() => setOpen(false)}
          className="text-xs text-brand-600 hover:text-brand-700 font-medium transition-colors"
        >
          Manage projects →
        </Link>
      </div>
    </div>
  )

  if (variant === 'header') {
    return (
      <div ref={containerRef} className="relative">
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-2 rounded-lg py-1.5 px-2.5 hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-colors text-left max-w-[200px]"
        >
          <IconFolder size={15} className="text-brand-600 shrink-0" />
          <span className="text-sm font-medium text-slate-800 truncate">{currentName}</span>
          <IconChevronDown size={14} className={`text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        {dropdown}
      </div>
    )
  }

  if (collapsed) {
    return (
      <div ref={containerRef} className="px-2.5 mb-2 shrink-0 relative">
        <button
          type="button"
          title={currentName}
          onClick={() => setOpen(o => !o)}
          className="w-full flex justify-center p-2 rounded-lg text-slate-500 hover:text-brand-600 hover:bg-brand-50 transition-colors"
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
        className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors text-left"
      >
        <IconFolder size={15} className="text-brand-600 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-wide text-slate-400 leading-none mb-0.5">Project</p>
          <p className="text-sm font-medium text-slate-900 truncate leading-tight">{currentName}</p>
        </div>
        <IconChevronDown size={14} className={`text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {dropdown}
    </div>
  )
}
