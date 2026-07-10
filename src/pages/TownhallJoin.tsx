import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../api/client'
import { useT } from '../i18n'
import { useTownhallSession } from '../hooks/useTownhallSession'
import { TownhallQuestionCard } from '../ui/TownhallQuestionCard'
import { inputHint } from '../ui/input-hint'
import ParticipantShell from '../layouts/ParticipantShell'

type Lookup =
  | { status: 'loading' }
  | { status: 'ready'; sessionId: string; title: string }
  | { status: 'error'; message: string }

/** Participant view: submit anonymous questions + upvote others'. */
export default function TownhallJoin() {
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

  if (lookup.status === 'loading') return <div className="p-12 text-center text-pulse-500">…</div>
  if (lookup.status === 'error') return <div className="p-12 text-center text-red-600">{lookup.message}</div>
  return <Board sessionId={lookup.sessionId} title={lookup.title} />
}

function Board({ sessionId, title }: { sessionId: string; title: string }) {
  const t = useT('townhall')
  const { state, submitQuestion, upvote } = useTownhallSession(sessionId)
  const [body, setBody] = useState('')
  const [name, setName] = useState('')
  const [useName, setUseName] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const nameAllowed = state.moderation !== null // display name is only forbidden in zero-knowledge (server enforces)

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = body.trim()
    if (trimmed.length < 3) return
    submitQuestion(trimmed, useName && name.trim() ? name.trim() : undefined)
    setBody('')
    setSubmitted(true)
    setTimeout(() => setSubmitted(false), 3000)
  }

  const connectionLabel =
    state.connection !== 'open'
      ? state.connection === 'failed'
        ? t('connection.failed')
        : t('connection.reconnecting')
      : null

  return (
    <ParticipantShell title={title} connectionLabel={connectionLabel}>
      <form onSubmit={onSubmit} className="space-y-3">
        <label htmlFor="th-body" className="block text-sm font-semibold text-pulse-800 dark:text-[#F0F2F8]">
          {t('submit.title')}
        </label>
        <textarea
          id="th-body"
          value={body}
          onChange={(e) => setBody(e.target.value.slice(0, 500))}
          {...inputHint(t('submit.hint'))}
          rows={3}
          maxLength={500}
          className="w-full rounded-lg border border-pulse-200 px-4 py-3 text-sm focus:ring-2 focus:ring-teal-500"
        />
        {nameAllowed && (
          <div className="flex items-center gap-2 text-sm">
            <input id="th-usename" type="checkbox" checked={useName} onChange={(e) => setUseName(e.target.checked)} />
            <label htmlFor="th-usename" className="text-pulse-600 dark:text-[#A8B3CC]">
              {t('submit.nameToggle')}
            </label>
            {useName && (
              <input
                value={name}
                onChange={(e) => setName(e.target.value.slice(0, 40))}
                {...inputHint(t('submit.namePlaceholder'))}
                className="flex-1 rounded-md border border-pulse-200 px-2 py-1"
              />
            )}
          </div>
        )}
        <button
          type="submit"
          disabled={body.trim().length < 3}
          className="w-full rounded-lg bg-teal-600 py-2.5 font-medium text-white hover:bg-teal-700 disabled:opacity-50"
        >
          {t('submit.button')}
        </button>
        {submitted && <p className="text-sm font-medium text-teal-700 dark:text-teal-400">{t('submit.success')}</p>}
        {state.moderation === 'pre' && <p className="text-xs text-pulse-500">{t('submit.pendingNote')}</p>}
      </form>

      <section className="space-y-2" aria-live="polite">
        <h2 className="text-sm font-bold uppercase tracking-wide text-pulse-500">{t('queue.title')}</h2>
        {state.items.length === 0 ? (
          <p className="text-sm text-pulse-500">{t('queue.empty')}</p>
        ) : (
          state.items.map((item) => (
            <TownhallQuestionCard
              key={item.id}
              item={item}
              variant="audience"
              upvoted={state.myUpvotes.includes(item.id)}
              onUpvote={upvote}
              t={t}
            />
          ))
        )}
      </section>
    </ParticipantShell>
  )
}
