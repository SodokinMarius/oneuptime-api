interface TabItem<T extends string> {
  id: T
  label: string
}

interface TabsProps<T extends string> {
  tabs: TabItem<T>[]
  active: T
  onChange: (id: T) => void
  className?: string
}

export function Tabs<T extends string>({ tabs, active, onChange, className = '' }: TabsProps<T>) {
  return (
    <div className={`tabs mb-6 ${className}`.trim()} role="tablist">
      {tabs.map(tab => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={active === tab.id}
          onClick={() => onChange(tab.id)}
          className={`tab ${active === tab.id ? 'tab-active' : 'tab-inactive'}`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
