import type { MonitorStatus } from '@/types'

const colors: Record<MonitorStatus, { dot: string; ring: string }> = {
  operational: { dot: 'bg-emerald-500', ring: 'bg-emerald-400' },
  degraded:    { dot: 'bg-amber-400',   ring: 'bg-amber-300' },
  offline:     { dot: 'bg-red-500',     ring: 'bg-red-400' },
  disabled:    { dot: 'bg-gray-300',    ring: '' },
}

export function StatusDot({ status }: { status: MonitorStatus }) {
  const { dot, ring } = colors[status]
  return (
    <span className="relative flex h-2.5 w-2.5 shrink-0">
      {status === 'operational' && (
        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${ring} opacity-75`} />
      )}
      <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${dot}`} />
    </span>
  )
}
