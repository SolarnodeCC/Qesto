import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api, apiRetry, getAuthToken } from '../api/client'
import { useT } from '../i18n'
import { itemsByColumn, useRetroSession, type RetroColumn } from '../hooks/useRetroSession'
import { RetroItemCard } from '../ui/RetroItemCard'
import { inputHint } from '../ui/input-hint'

type RetroConfig = {
  sessionId: string
  title: string
  code: string
  status: string
  dotVoteLimit: number
}

const COLUMNS: RetroColumn[] = ['went_well', 'didnt_go_well', 'actions']

/** Host retro board: start session, share join link, live 3-column view. */
export default function RetroPresent() {
  const { id } = useParams<{ id: string }>()
  const presenterToken = getAuthToken() ?? undefined
  const t = useT('retro')
  const [config, setConfig] = useState<RetroConfig | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)
  const live = config?.status === 'live' || config?.status === 'energizing'
  const { state, submit } = useRetroSession(id, {
    enabled: !!id && live,
    ...(presenterToken ? { presenterToken } : {}),
  })

  const refreshConfig = useCallback(async () => {
    if (!id) return
    const res = await api<RetroConfig>(`/api/sessions/${encodeURIComponent(id)}/retro/config`)
    if (res.ok) setConfig(res.data)
    else setLoadError(res.error.message)
  }, [id])

  useEffect(() => {
    void refreshConfig()
  }, [refreshConfig])

  async function handleStart() {
    if (!id) return
    setStarting(true)
    setStartError(null)
    const res = await apiRetry<{ session: { status: string } }>(`/api/sessions/${encodeURIComponent(id)}/start`, {
      method: 'POST',
    })
    setStarting(false)
    if (!res.ok) {
      setStartError(res.error.message)
      return
    }
    await refreshConfig()
  }

  if (loadError) return <div className="p-8 text-center text-red-600">{loadError}</div>
  if (!config) return <div className="p-8 text-center text-pulse-500">…</div>

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-5 py-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold text-pulse-900 dark:text-pulse-100">{config.title}</h1>
          <p className="text-sm text-pulse-500">{t('present.subtitle')}</p>
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
            {t('present.joinAt')}{' '}
            <span className="font-mono font-semibold">qesto.cc/r/{config.code}</span>
          </p>
          <p className="mt-1 text-xs text-pulse-500">
            {t('present.dotLimit', { limit: config.dotVoteLimit })}
          </p>
        </section>
      )}

      {live && (
        <div className="grid gap-4 md:grid-cols-3" aria-live="polite">
          {COLUMNS.map((col) => (
            <RetroColumnPanel
              key={col}
              column={col}
              items={itemsByColumn(state.items, col)}
              onSubmit={(body) => submit(col, body)}
              t={t}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function RetroColumnPanel({
  column,
  items,
  onSubmit,
  t,
}: {
  column: RetroColumn
  items: ReturnType<typeof itemsByColumn>
  onSubmit: (body: string) => void
  t: (key: string, vars?: Record<string, string | number>) => string
}) {
  const [body, setBody] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = body.trim()
    if (trimmed.length < 2) return
    onSubmit(trimmed)
    setBody('')
  }

  return (
    <section className="flex flex-col rounded-xl border border-pulse-200 bg-white p-4 dark:border-pulse-700 dark:bg-pulse-900/40">
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-pulse-600 dark:text-pulse-300">
        {t(`column.${column}`)}
      </h2>
      <form onSubmit={handleSubmit} className="mb-3 space-y-2">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value.slice(0, 500))}
          {...inputHint(t('submit.hint'))}
          rows={2}
          className="w-full rounded-md border border-pulse-200 px-3 py-2 text-sm dark:border-pulse-600 dark:bg-pulse-800"
        />
        <button
          type="submit"
          disabled={body.trim().length < 2}
          className="w-full rounded-md bg-pulse-800 py-1.5 text-xs font-medium text-white hover:bg-pulse-700 disabled:opacity-50 dark:bg-pulse-600"
        >
          {t('submit.button')}
        </button>
      </form>
      <div className="flex-1 space-y-2">
        {items.length === 0 ? (
          <p className="text-xs text-pulse-500">{t('column.empty')}</p>
        ) : (
          items.map((item) => <RetroItemCard key={item.id} item={item} variant="present" t={t} />)
        )}
      </div>
    </section>
  )
}
