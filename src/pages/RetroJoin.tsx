import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../api/client'
import { useT } from '../i18n'
import { itemsByColumn, useRetroSession, type RetroColumn } from '../hooks/useRetroSession'
import { RetroItemCard } from '../ui/RetroItemCard'
import { inputHint } from '../ui/input-hint'

type Lookup =
  | { status: 'loading' }
  | { status: 'ready'; sessionId: string; title: string }
  | { status: 'error'; message: string }

const COLUMNS: RetroColumn[] = ['went_well', 'didnt_go_well', 'actions']

/** Participant retro board: submit cards and dot-vote action items. */
export default function RetroJoin() {
  const { code } = useParams<{ code: string }>()
  const [lookup, setLookup] = useState<Lookup>({ status: 'loading' })

  useEffect(() => {
    if (!code) return
    let cancelled = false
    ;(async () => {
      const res = await api<{ id: string; title: string }>(`/api/sessions/by-code/${encodeURIComponent(code.toUpperCase())}`)
      if (cancelled) return
      if (res.ok) setLookup({ status: 'ready', sessionId: res.data.id, title: res.data.title })
      else setLookup({ status: 'error', message: res.error.message })
    })()
    return () => {
      cancelled = true
    }
  }, [code])

  if (lookup.status === 'loading') return <div className="p-8 text-center text-pulse-500">…</div>
  if (lookup.status === 'error') return <div className="p-8 text-center text-red-600">{lookup.message}</div>
  return <Board sessionId={lookup.sessionId} title={lookup.title} />
}

function Board({ sessionId, title }: { sessionId: string; title: string }) {
  const t = useT('retro')
  const { state, submit, upvote } = useRetroSession(sessionId)
  const [column, setColumn] = useState<RetroColumn>('went_well')
  const [body, setBody] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const dotsRemaining = state.dotVoteLimit - state.dotsUsed

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = body.trim()
    if (trimmed.length < 2) return
    submit(column, trimmed)
    setBody('')
    setSubmitted(true)
    setTimeout(() => setSubmitted(false), 3000)
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-5 py-8">
      <header>
        <h1 className="text-xl font-bold text-pulse-900 dark:text-pulse-100">{title}</h1>
        {state.connection !== 'open' && (
          <p className="text-xs text-amber-600">
            {state.connection === 'failed' ? t('connection.failed') : t('connection.reconnecting')}
          </p>
        )}
      </header>

      <form onSubmit={onSubmit} className="space-y-3 rounded-lg border border-pulse-200 p-4 dark:border-pulse-700">
        <label className="block text-sm font-semibold text-pulse-800 dark:text-pulse-200">{t('submit.title')}</label>
        <div className="flex flex-wrap gap-2" role="tablist">
          {COLUMNS.map((col) => (
            <button
              key={col}
              type="button"
              role="tab"
              aria-selected={column === col}
              onClick={() => setColumn(col)}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                column === col
                  ? 'bg-teal-600 text-white'
                  : 'bg-pulse-100 text-pulse-600 dark:bg-pulse-800 dark:text-pulse-300'
              }`}
            >
              {t(`column.${col}`)}
            </button>
          ))}
        </div>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value.slice(0, 500))}
          {...inputHint(t('submit.hint'))}
          rows={3}
          className="w-full rounded-lg border border-pulse-200 px-4 py-3 text-sm focus:ring-2 focus:ring-teal-500 dark:border-pulse-600 dark:bg-pulse-800"
        />
        <button
          type="submit"
          disabled={body.trim().length < 2}
          className="w-full rounded-lg bg-teal-600 py-2.5 font-medium text-white hover:bg-teal-700 disabled:opacity-50"
        >
          {t('submit.button')}
        </button>
        {submitted && <p className="text-sm font-medium text-teal-700 dark:text-teal-400">{t('submit.success')}</p>}
      </form>

      {state.dotVoteLimit > 0 && (
        <p className="text-xs text-pulse-500">
          {t('vote.dotsRemaining', { remaining: dotsRemaining, limit: state.dotVoteLimit })}
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-3" aria-live="polite">
        {COLUMNS.map((col) => (
          <section key={col} className="space-y-2">
            <h2 className="text-sm font-bold uppercase tracking-wide text-pulse-500">{t(`column.${col}`)}</h2>
            {itemsByColumn(state.items, col).length === 0 ? (
              <p className="text-xs text-pulse-500">{t('column.empty')}</p>
            ) : (
              itemsByColumn(state.items, col).map((item) => (
                <RetroItemCard
                  key={item.id}
                  item={item}
                  variant="join"
                  upvoted={state.myUpvotes.includes(item.id)}
                  canVote={dotsRemaining > 0}
                  onUpvote={upvote}
                  t={t}
                />
              ))
            )}
          </section>
        ))}
      </div>
    </div>
  )
}
