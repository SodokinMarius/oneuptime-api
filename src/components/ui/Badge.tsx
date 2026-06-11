interface BadgeProps {
  label: string
  color?: string
}

const presets: Record<string, string> = {
  operational: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  degraded:    'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  offline:     'bg-red-50 text-red-600 ring-1 ring-red-200',
  disabled:    'bg-gray-100 text-gray-500 ring-1 ring-gray-200',
  success:     'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  failure:     'bg-red-50 text-red-600 ring-1 ring-red-200',
  timeout:     'bg-orange-50 text-orange-700 ring-1 ring-orange-200',
  error:       'bg-red-50 text-red-600 ring-1 ring-red-200',
  scheduled:   'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
  in_progress: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  completed:   'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  cancelled:   'bg-gray-100 text-gray-500 ring-1 ring-gray-200',
  critical:    'bg-red-50 text-red-600 ring-1 ring-red-200',
  high:        'bg-orange-50 text-orange-700 ring-1 ring-orange-200',
  medium:      'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  low:         'bg-violet-50 text-violet-700 ring-1 ring-violet-200',
}

export function Badge({ label, color }: BadgeProps) {
  const key = label.toLowerCase().replace(/\s+/g, '_')
  const cls = presets[key] ?? 'bg-gray-100 text-gray-600 ring-1 ring-gray-200'
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${cls}`}
      style={color ? { backgroundColor: `${color}15`, color, boxShadow: `0 0 0 1px ${color}30` } : undefined}
    >
      {label}
    </span>
  )
}
