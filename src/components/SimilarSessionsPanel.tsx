import { useCallback, useState } from 'react'
import { api } from '../api/client'
import { useT } from '../i18n'
import { inputHint } from '../ui/input-hint'

type SimilarSession = {
  id: string
  score: number
  excerpt: string
}

type Props = {
  sessionId: string
  defaultQuery?: string
  enabled?: boolean
}

export function SimilarSessionsPanel({ sessionId, defaultQuery = '', enabled = true }: Props) {
  const t = useT('insights')
  const [query, setQuery] = useState(defaultQuery)
  const [results, setResults] = useState<SimilarSession[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const search = useCallback(async () => {
    if (!enabled || query.trim().length < 3) return
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ theme: query.trim() })
      const res = await api<{ sessions: SimilarSession[] }>(
        `/api/sessions/${sessionId}/coaching/similar?${params}`,
      )
      if (res.ok) setResults(res.data.sessions)
      else setError(res.error.message)
    } catch {
      setError(t('similar.loadError'))
    } finally {
      setLoading(false)
    }
  }, [sessionId, query, enabled, t])

  if (!enabled) return null

  return (
    <section className="rounded-lg border border-pulse-200 bg-white p-4 dark:border-[var(--color-border-strong)] dark:bg-[var(--color-surface-elevated)]">
      <h3 className="text-sm font-semibold text-pulse-900 dark:text-[var(--text-primary)]">{t('similar.title')}</h3>
      <p className="mt-1 text-xs text-pulse-500 dark:text-[var(--text-secondary)]">{t('similar.description')}</p>
      <div className="mt-3 flex gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          {...inputHint(t('similar.hint'))}
          className="min-w-0 flex-1 rounded-md border border-pulse-200 px-3 py-2 text-sm dark:border-[var(--color-border-strong)] dark:bg-[#141B33] dark:text-[var(--text-primary)]"
          aria-label={t('similar.hint')}
        />
        <button
          type="button"
          disabled={loading || query.trim().length < 3}
          onClick={() => void search()}
          className="rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:brightness-110 disabled:opacity-50"
        >
          {loading ? t('similar.searching') : t('similar.search')}
        </button>
      </div>
      {error && (
        <p className="mt-2 text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
      {results.length > 0 && (
        <ul className="mt-4 space-y-2">
          {results.map((s) => (
            <li
              key={s.id}
              className="rounded-md border border-pulse-100 p-3 text-sm dark:border-[var(--color-border-strong)]"
            >
              <span className="text-xs text-pulse-500">{Math.round(s.score * 100)}% match</span>
              <p className="mt-1 text-pulse-700 dark:text-[#C5D0E6]">{s.excerpt}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
