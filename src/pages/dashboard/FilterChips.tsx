import { useT } from '../../i18n'
import type { StatusFilter } from './types'

export function FilterChips({ value, onChange }: { value: StatusFilter; onChange: (v: StatusFilter) => void }) {
  const t = useT('dashboard')
  const chips: { id: StatusFilter; label: string }[] = [
    { id: 'all',    label: t('filterAll') },
    { id: 'live',   label: t('filterLive') },
    { id: 'draft',  label: t('filterDraft') },
    { id: 'closed', label: t('filterClosed') },
  ]
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter op status">
      {chips.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          aria-pressed={value === id}
          onClick={() => onChange(id)}
          className={[
            'rounded-full px-3 py-1 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-1',
            value === id
              ? 'bg-teal-600 text-white shadow-inner'
              : 'bg-white dark:bg-[var(--color-surface)] border border-pulse-200 dark:border-[var(--color-border)] text-pulse-600 dark:text-[var(--text-secondary)] hover:border-teal-400 dark:hover:border-teal-600 hover:text-teal-700 dark:hover:text-teal-400',
          ].join(' ')}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
