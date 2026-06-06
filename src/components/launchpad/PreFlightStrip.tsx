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

  return (
    <>
      <section
        aria-label={t('checklist_title')}
        className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-pulse-200 dark:border-[#1E2A45] bg-pulse-50 dark:bg-[#0F1525] px-4 py-3"
      >
        {items.map((item) => (
          <div key={item.key} className="flex items-center gap-2">
            <div
              className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                item.valid
                  ? 'bg-teal-100 border-teal-500 dark:bg-teal-900/40 dark:border-teal-500'
                  : 'bg-red-50 border-red-300 dark:bg-red-900/30 dark:border-red-500'
              }`}
            >
              {item.valid && (
                <svg aria-hidden="true" width="8" height="8" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" className="text-teal-600 dark:text-teal-400">
                  <path d="M2 5l2.5 2.5L8 3" />
                </svg>
              )}
            </div>
            <span className={`text-caption ${item.valid ? 'text-pulse-700 dark:text-pulse-300' : 'text-red-600 dark:text-red-400'}`}>
              {item.label}
            </span>
            {!item.valid && item.message && (
              <span className="sr-only">: {item.message}</span>
            )}
          </div>
        ))}
      </section>
      {(loading || error) && (
        <p
          role={error ? 'alert' : 'status'}
          className={error ? 'text-sm text-amber-600' : 'text-sm text-pulse-500'}
        >
          {error ?? t('preflight_checking')}
        </p>
      )}
    </>
  )
}
