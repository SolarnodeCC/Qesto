// STUDIO-LIBRARY-01 — list, fork, remove saved library items.
import type { StudioLibraryItem } from './types'

type Props = {
  t: (key: string, vars?: Record<string, string | number>) => string
  items: StudioLibraryItem[]
  loading: boolean
  forkingId: string | null
  deletingId: string | null
  onFork: (id: string) => void
  onDelete: (id: string) => void
}

export function LibraryPanel({ t, items, loading, forkingId, deletingId, onDelete, onFork }: Props) {
  return (
    <section aria-labelledby="studio-library-heading" className="rounded-lg border border-pulse-200 bg-white p-6 dark:border-[#2A3858] dark:bg-pulse-900/40">
      <h2 id="studio-library-heading" className="text-lg font-semibold text-pulse-900 dark:text-[#F0F2F8]">
        {t('library.heading')}
      </h2>

      {loading && (
        <div className="mt-3 space-y-2" aria-hidden="true">
          {[1, 2].map((i) => (
            <div key={i} className="h-24 rounded bg-pulse-100 skeleton-shimmer dark:bg-pulse-800" />
          ))}
        </div>
      )}

      {!loading && items.length === 0 && (
        <p className="mt-3 text-sm text-pulse-500 dark:text-[#9AA8C7]">{t('library.empty')}</p>
      )}

      {!loading && items.length > 0 && (
        <ul className="mt-3 space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex flex-col gap-2 rounded border border-pulse-200 p-3 sm:flex-row sm:items-center sm:justify-between dark:border-[#2A3858]"
            >
              <div>
                <p className="text-sm font-medium text-pulse-900 dark:text-[#F0F2F8]">{item.title}</p>
                <p className="text-xs text-pulse-500 dark:text-[#9AA8C7]">{t('library.useCount', { count: item.use_count })}</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onFork(item.id)}
                  disabled={forkingId === item.id}
                  className="min-h-[44px] rounded-lg border border-pulse-300 px-3 py-1.5 text-sm font-medium text-pulse-700 hover:bg-pulse-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 disabled:opacity-50 dark:border-[#2A3858] dark:text-[#A8B3CC] dark:hover:bg-white/5"
                >
                  {forkingId === item.id ? t('library.forking') : t('library.fork')}
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(item.id)}
                  disabled={deletingId === item.id}
                  className="min-h-[44px] rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:opacity-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-900/30"
                >
                  {deletingId === item.id ? t('library.deleting') : t('library.delete')}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
