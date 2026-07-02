import { Check, CircleCheckBig, Loader2, X } from 'lucide-react'
import { useT } from '../../i18n'

export type PreFlightItem = {
  key: string
  label: string
  valid: boolean
  message?: string
}

type Props = {
  items: PreFlightItem[]
  loading: boolean
  error: string | null
}

export default function PreFlightStrip({ items, loading, error }: Props) {
  const t = useT('launchpad')
  const allValid = items.every((i) => i.valid)

  return (
    <section
      aria-label={t('checklist_title')}
      className="rounded-xl border border-[var(--color-border,var(--color-border))] dark:border-[var(--color-border)] bg-white dark:bg-[var(--color-surface)] shadow-card overflow-hidden"
    >
      {/* Card header */}
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-[var(--color-border,var(--color-border))] dark:border-[var(--color-border)]">
        {loading
          ? <Loader2 size={17} className="text-pulse-400 animate-spin shrink-0" aria-hidden="true" />
          : <CircleCheckBig
              size={17}
              className={`shrink-0 ${allValid ? 'text-green-500' : 'text-pulse-400'}`}
              aria-hidden="true"
            />}
        <span className="text-sm font-semibold text-[var(--text-primary,var(--color-bg-subtle))] dark:text-[var(--text-primary)]">
          {t('checklist_title')}
        </span>
        {!loading && (
          <span
            className={`ml-auto text-xs font-semibold ${
              allValid ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'
            }`}
          >
            {allValid ? t('preflight_ready') : t('preflight_not_ready')}
          </span>
        )}
      </div>

      {/* Check rows */}
      <ul className="divide-y divide-[var(--color-border,var(--color-border))] dark:divide-[var(--color-border)]">
        {items.map((item) => (
          <li key={item.key} className="flex items-center gap-3 px-5 py-3">
            {/* Status icon */}
            <span
              className={`w-[18px] h-[18px] shrink-0 rounded-full flex items-center justify-center ${
                item.valid
                  ? 'bg-green-500'
                  : 'bg-red-50 dark:bg-red-900/30 border border-red-300 dark:border-red-600'
              }`}
            >
              {item.valid
                ? <Check size={11} className="text-white" aria-hidden="true" />
                : <X size={10} className="text-red-500 dark:text-red-400" aria-hidden="true" />}
            </span>

            {/* Label */}
            <span className={`text-sm ${item.valid ? 'text-[var(--text-primary,var(--color-bg-subtle))] dark:text-[var(--text-primary)]' : 'text-red-600 dark:text-red-400'}`}>
              {item.label}
            </span>

            {/* Status message */}
            {item.message && (
              <span className="ml-auto text-xs text-[var(--text-muted,var(--text-muted))] dark:text-[var(--text-muted)]">
                {item.message}
              </span>
            )}
          </li>
        ))}
      </ul>

      {/* Loading or error feedback */}
      {(loading || error) && (
        <p role={error ? 'alert' : 'status'} className={`px-5 py-2.5 text-sm border-t ${
          error
            ? 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
            : 'text-pulse-600 dark:text-pulse-400 bg-pulse-50 dark:bg-pulse-900/10 border-pulse-200 dark:border-pulse-800'
        }`}>
          {error || t('preflight_checking')}
        </p>
      )}
    </section>
  )
}
