import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { rbacApi } from '@/api/rbac'

interface PermissionPickerProps {
  value: string[]
  onChange: (permissions: string[]) => void
  allowWildcard?: boolean
}

export function PermissionPicker({ value, onChange, allowWildcard = true }: PermissionPickerProps) {
  const [permInput, setPermInput] = useState('')

  const { data: allPerms, isLoading } = useQuery({
    queryKey: ['permissions'],
    queryFn: () => rbacApi.roles.permissions().then(r => r.data.permissions),
  })

  const togglePerm = (p: string) => {
    onChange(value.includes(p) ? value.filter(x => x !== p) : [...value, p])
  }

  const addCustom = () => {
    const trimmed = permInput.trim()
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed])
      setPermInput('')
    }
  }

  const grouped = (allPerms ?? []).reduce<Record<string, string[]>>((acc, p) => {
    const [res] = p.split(':')
    if (!acc[res]) acc[res] = []
    acc[res].push(p)
    return acc
  }, {})

  const hasWildcard = value.includes('*')

  return (
    <div>
      {allowWildcard && (
        <button
          type="button"
          onClick={() => onChange(hasWildcard ? [] : ['*'])}
          className={`text-xs px-3 py-1 rounded-full border mb-3 transition-colors ${
            hasWildcard ? 'bg-brand-600 text-white border-brand-600' : 'border-gray-300 text-gray-600 hover:bg-gray-50'
          }`}
        >
          Toutes les permissions (*)
        </button>
      )}

      {!hasWildcard && (
        <>
          {isLoading ? (
            <p className="text-sm text-gray-400 py-4 text-center">Chargement des permissions…</p>
          ) : (
            <div className="max-h-56 overflow-y-auto border border-gray-200 rounded-lg p-3 space-y-3">
              {Object.entries(grouped).map(([res, perms]) => (
                <div key={res}>
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-1">{res.replace(/_/g, ' ')}</p>
                  <div className="flex flex-wrap gap-2">
                    {perms.map(p => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => togglePerm(p)}
                        className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                          value.includes(p)
                            ? 'bg-brand-100 text-brand-700 border-brand-300'
                            : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        {p.split(':')[1] ?? p}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2 mt-2">
            <input
              value={permInput}
              onChange={e => setPermInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustom() } }}
              className="input-field flex-1"
              placeholder="Wildcard ou permission personnalisée (ex. monitor:*)"
            />
            <button type="button" onClick={addCustom} className="btn-secondary btn-sm shrink-0">
              Ajouter
            </button>
          </div>
        </>
      )}

      {value.length > 0 && !hasWildcard && (
        <div className="flex flex-wrap gap-1 mt-2">
          {value.map(p => (
            <span key={p} className="inline-flex items-center gap-1 text-xs bg-brand-50 text-brand-700 px-2 py-0.5 rounded-full font-mono">
              {p}
              <button type="button" onClick={() => togglePerm(p)} className="hover:text-red-600 ml-0.5" aria-label={`Retirer ${p}`}>×</button>
            </span>
          ))}
        </div>
      )}

      {hasWildcard && (
        <p className="text-xs text-gray-500 mt-1">Accès complet à toutes les ressources du projet.</p>
      )}
    </div>
  )
}
