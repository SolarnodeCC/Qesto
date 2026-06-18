import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api, apiRetry, getAuthToken } from '../api/client'
import { useT } from '../i18n'
import { useTownhallSession, type TownhallItemStatus } from '../hooks/useTownhallSession'
import { TownhallQuestionCard } from '../ui/TownhallQuestionCard'

type TownhallConfig = {
  sessionId: string
  title: string
  code: string
  status: string
  sessionMode: string
  moderation: 'pre' | 'post' | null
}

const TABS: { key: TownhallItemStatus; label: string }[] = [
  { key: 'pending', label: 'console.pending' },
  { key: 'approved', label: 'console.approved' },
  { key: 'answered', label: 'console.answered' },
  { key: 'dismissed', label: 'console.dismissed' },
]

/** Host moderation console: start session, share join link, then tabbed
 *  queue with approve/dismiss/answer/spotlight. The board runs over the
 *  SessionRoom WebSocket, which only accepts connections once the session is
 *  live — so we gate the socket on lifecycle state (mirrors RetroPresent). */
export default function TownhallPresent() {
  const { id } = useParams<{ id: string }>()
  const presenterToken = getAuthToken() ?? undefined
  const t = useT('townhall')
  const [config, setConfig] = useState<TownhallConfig | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)
  const [tab, setTab] = useState<TownhallItemStatus>('pending')
  const startingRef = useRef(false)

  const live = config?.status === 'live' || config?.status === 'energizing'
  const { state, moderate } = useTownhallSession(id, {
    enabled: !!id && live,
    ...(presenterToken ? { presenterToken } : {}),
  })

  const refreshConfig = useCallback(async () => {
    if (!id) return
    const res = await api<TownhallConfig>(`/api/sessions/${encodeURIComponent(id)}/townhall/config`)
    if (res.ok) setConfig(res.data)
    else setLoadError(res.error.message)
  }, [id])

  useEffect(() => {
    void refreshConfig()
  }, [refreshConfig])

  async function handleStart() {
    if (!id || startingRef.current) return
    startingRef.current = true
    setStarting(true)
    setStartError(null)
    try {
      // Retry transient SessionRoom DO unavailability (do_init_failed); /start
      // rolls back to draft on failure, so re-issuing is idempotent.
      const res = await apiRetry<{ session: { status: string } }>(`/api/sessions/${encodeURIComponent(id)}/start`, {
        method: 'POST',
      })
      if (!res.ok) {
        setStartError(res.error.message)
        return
      }
      await refreshConfig()
    } finally {
      startingRef.current = false
      setStarting(false)
    }
  }

  const counts = useMemo(() => {
    const c: Record<string, number> = { pending: 0, approved: 0, answered: 0, dismissed: 0 }
    for (const i of state.items) c[i.status] = (c[i.status] ?? 0) + 1
    return c
  }, [state.items])

  if (loadError) return <div className="p-8 text-center text-red-600">{loadError}</div>
  if (!config) return <div className="p-8 text-center text-pulse-500">…</div>

  const visible = state.items.filter((i) => i.status === tab)

  return (
    <div className="mx-auto max-w-2xl space-y-5 px-5 py-6">
      <header className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold text-pulse-900 dark:text-[#F0F2F8]">{config.title}</h1>
          <p className="text-sm text-pulse-500">{t('console.title')}</p>
        </div>
        {live && state.connection !== 'open' && (
          <span className="text-xs text-amber-600">
            {state.connection === 'failed' ? t('connection.failed') : t('connection.reconnecting')}
          </span>
        )}
      </header>

      {!live && (
        <section className="rounded-lg border border-teal-200 bg-teal-50 p-5 dark:border-teal-800 dark:bg-teal-900/20">
          <p className="text-sm text-teal-800 dark:text-teal-200">{t('present.draftHint')}</p>
          <button
            type="button"
            onClick={() => void handleStart()}
            disabled={starting}
            className="mt-3 rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
          >
            {starting ? t('present.starting') : t('present.start')}
          </button>
          {startError && <p className="mt-2 text-sm text-red-600">{startError}</p>}
        </section>
      )}

      {live && (
        <section className="rounded-lg border border-pulse-200 bg-pulse-50 p-4 dark:border-pulse-700 dark:bg-pulse-900/30">
          <p className="text-sm text-pulse-700 dark:text-pulse-300">
            {t('present.joinAt')} <span className="font-mono font-semibold">qesto.cc/th/{config.code}</span>
          </p>
        </section>
      )}

      {live && (
        <>
          <div className="flex gap-1 border-b border-pulse-200" role="tablist">
            {TABS.map((tabDef) => (
              <button
                key={tabDef.key}
                role="tab"
                aria-selected={tab === tabDef.key}
                onClick={() => setTab(tabDef.key)}
                className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
                  tab === tabDef.key
                    ? 'border-teal-500 text-teal-700 dark:text-teal-400'
                    : 'border-transparent text-pulse-500 dark:text-[#6B7A99] hover:text-pulse-800 dark:hover:text-[#F0F2F8]'
                }`}
              >
                {t(tabDef.label)} ({counts[tabDef.key] ?? 0})
              </button>
            ))}
          </div>

          <section className="space-y-2" aria-live="polite">
            {visible.length === 0 ? (
              <p className="py-8 text-center text-sm text-pulse-400">{t('console.empty')}</p>
            ) : (
              visible.map((item) => (
                <TownhallQuestionCard key={item.id} item={item} variant="console" onModerate={moderate} t={t} />
              ))
            )}
          </section>
        </>
      )}
    </div>
  )
}
