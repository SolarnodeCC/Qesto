import { useCallback, useEffect, useState } from 'react'
import { api } from '../api/client'
import { useT } from '../i18n'

type CoachingPayload = {
  headline: string
  bullets: string[]
  confidence?: number
}

type CoachingTurn = {
  role: 'user' | 'assistant'
  content: string
  at: number
}

type Props = {
  sessionId: string
  enabled?: boolean
}

export function CoachingCard({ sessionId, enabled = true }: Props) {
  const t = useT('insights')
  const [loading, setLoading] = useState(false)
  const [coaching, setCoaching] = useState<CoachingPayload | null>(null)
  const [history, setHistory] = useState<CoachingTurn[]>([])
  const [error, setError] = useState<string | null>(null)
  const [actionMsg, setActionMsg] = useState<string | null>(null)
  const [emailSending, setEmailSending] = useState(false)

  const loadHistory = useCallback(async () => {
    const res = await api<{ history: CoachingTurn[] }>(`/api/sessions/${sessionId}/coaching/history`)
    if (res.ok) setHistory(res.data.history)
  }, [sessionId])

  const load = useCallback(async () => {
    if (!enabled) return
    setLoading(true)
    setError(null)
    setActionMsg(null)
    try {
      const res = await api<{ coaching: CoachingPayload; history?: CoachingTurn[] }>(
        `/api/sessions/${sessionId}/coaching`,
        { method: 'POST', body: {} },
      )
      if (res.ok && res.data.coaching) {
        setCoaching(res.data.coaching)
        if (res.data.history) setHistory(res.data.history)
        else await loadHistory()
      } else {
        setError(!res.ok ? res.error.message : t('coaching.unavailable'))
      }
    } catch {
      setError(t('coaching.loadError'))
    } finally {
      setLoading(false)
    }
  }, [sessionId, enabled, loadHistory, t])

  useEffect(() => {
    if (enabled) void loadHistory()
  }, [enabled, loadHistory])

  const recordAction = async (action: 'accepted' | 'dismissed' | 'saved_template') => {
    if (!coaching) return
    setActionMsg(null)
    const res = await api(`/api/sessions/${sessionId}/coaching/action`, {
      method: 'POST',
      body: { action, headline: coaching.headline },
    })
    if (res.ok) {
      const key =
        action === 'accepted' ? 'coaching.accepted'
        : action === 'dismissed' ? 'coaching.dismissed'
        : 'coaching.savedTemplate'
      setActionMsg(t(key))
    }
  }

  const emailExport = async () => {
    setEmailSending(true)
    setActionMsg(null)
    try {
      const res = await api(`/api/sessions/${sessionId}/coaching/email-export`, { method: 'POST', body: {} })
      setActionMsg(res.ok ? t('coaching.emailSent') : t('coaching.emailFailed'))
    } catch {
      setActionMsg(t('coaching.emailFailed'))
    } finally {
      setEmailSending(false)
    }
  }

  if (!enabled) return null

  return (
    <section
      className="rounded-lg border border-violet-200 bg-violet-50/80 p-4 dark:border-violet-800 dark:bg-violet-950/40"
      aria-labelledby="coaching-card-heading"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="coaching-card-heading" className="text-sm font-semibold text-violet-900 dark:text-violet-100">
          {t('coaching.title')}
        </h3>
        <button
          type="button"
          className="text-xs font-medium text-violet-700 underline dark:text-violet-300"
          disabled={loading}
          onClick={() => void load()}
        >
          {loading ? t('coaching.loading') : coaching ? t('coaching.refresh') : t('coaching.getSuggestions')}
        </button>
      </div>
      {error && (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}
      {actionMsg && <p className="mt-2 text-xs text-teal-700 dark:text-teal-300">{actionMsg}</p>}
      {coaching && (
        <div className="mt-3 space-y-3">
          <p className="text-sm font-medium text-violet-950 dark:text-violet-50">{coaching.headline}</p>
          <ul className="list-disc space-y-1 pl-4 text-sm text-violet-900 dark:text-violet-200">
            {coaching.bullets.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              className="rounded-md bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
              onClick={() => void recordAction('accepted')}
            >
              {t('coaching.accept')}
            </button>
            <button
              type="button"
              className="rounded-md border border-violet-300 px-3 py-1.5 text-xs font-medium text-violet-800 dark:border-violet-600 dark:text-violet-200"
              onClick={() => void recordAction('saved_template')}
            >
              {t('coaching.saveTemplate')}
            </button>
            <button
              type="button"
              className="rounded-md px-3 py-1.5 text-xs text-violet-600 underline dark:text-violet-400"
              onClick={() => void recordAction('dismissed')}
            >
              {t('coaching.dismiss')}
            </button>
            <button
              type="button"
              className="rounded-md px-3 py-1.5 text-xs text-violet-600 underline dark:text-violet-400"
              disabled={emailSending}
              onClick={() => void emailExport()}
            >
              {emailSending ? t('coaching.emailSending') : t('coaching.emailExport')}
            </button>
          </div>
        </div>
      )}
      {history.length > 0 && (
        <details className="mt-4 border-t border-violet-200 pt-3 dark:border-violet-800">
          <summary className="cursor-pointer text-xs font-medium text-violet-800 dark:text-violet-300">
            {t('coaching.priorSuggestions', { count: String(history.length) })}
          </summary>
          <ul className="mt-2 max-h-40 space-y-2 overflow-y-auto text-xs text-violet-800 dark:text-violet-300">
            {history.slice(-5).map((turn) => (
              <li key={`${turn.at}-${turn.role}`}>
                <span className="font-medium capitalize">{turn.role}:</span> {turn.content.slice(0, 120)}
                {turn.content.length > 120 ? '…' : ''}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}
