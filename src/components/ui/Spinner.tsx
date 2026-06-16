interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  label?: string
  className?: string
}

const sizes = {
  sm: 'w-5 h-5',
  md: 'w-8 h-8',
  lg: 'w-10 h-10',
}

export function Spinner({ size = 'md', label, className = '' }: SpinnerProps) {
  return (
    <div className={`loading-center ${className}`.trim()}>
      <div className={`spinner ${sizes[size]}`} role="status" aria-label={label ?? 'Chargement'} />
      {label && <p className="text-sm text-gray-400">{label}</p>}
    </div>
  )
}
