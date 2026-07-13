import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../api/client'
import { useT } from '../i18n'
import { ideasForCluster, unclusteredIdeas, useIdeateSession } from '../hooks/useIdeateSession'
import { IdeateIdeaCard } from '../ui/IdeateIdeaCard'
import { inputHint } from '../ui/input-hint'
import ParticipantShell from '../layouts/ParticipantShell'
import { CLUSTER_BORDER_COLORS, CLUSTER_COLOR_COUNT } from '../ui/cluster-colors'

type Lookup =
  | { status: 'loading' }
  | { status: 'ready'; sessionId: string; title: string }
  | { status: 'error'; message: string }

export default function IdeateJoin() {
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
  const t = useT('ideate')
  const { state, submit, upvote } = useIdeateSession(sessionId)
  const [body, setBody] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const dotsRemaining = state.dotVoteLimit - state.dotsUsed
  const activeIdeas = state.ideas.filter((i) => i.status === 'active')

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = body.trim()
    if (trimmed.length < 2) return
    submit(trimmed)
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
    <ParticipantShell title={title} connectionLabel={connectionLabel} maxWidth="4xl">
      <form onSubmit={onSubmit} className="space-y-3 rounded-lg border border-pulse-200 p-4 dark:border-pulse-700">
        <label className="block text-sm font-semibold text-pulse-800 dark:text-pulse-200">{t('submit.title')}</label>
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

      {dotsRemaining < state.dotVoteLimit && (
        <p className="text-xs text-pulse-500">
          {t('vote.dotsRemaining', { remaining: dotsRemaining, limit: state.dotVoteLimit })}
        </p>
      )}

      {state.rankingRevealed && state.ranking.length > 0 && (
        <section className="rounded-xl border-2 border-violet-300 bg-violet-50 p-4 dark:border-violet-700 dark:bg-violet-900/20">
          <h2 className="text-sm font-bold uppercase tracking-wide text-violet-700 dark:text-violet-300">
            {t('prioritize.title')}
          </h2>
          <ol className="mt-3 space-y-2">
            {state.ranking.map((entry) => (
              <li key={entry.ideaId} className="flex items-start gap-3 text-sm">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-600 text-xs font-bold text-white">
                  {entry.rank}
                </span>
                <span className="flex-1 text-pulse-800 dark:text-pulse-100">{entry.body}</span>
                <span className="text-xs text-violet-600 dark:text-violet-400">
                  {t('vote.count', { count: entry.upvotes })}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <div className="space-y-4" aria-live="polite">
        <h2 className="text-sm font-bold uppercase tracking-wide text-pulse-500">{t('clusters.title')}</h2>
        {state.clusters.length === 0 ? (
          <p className="text-sm text-pulse-500">{t('clusters.waiting')}</p>
        ) : (
          state.clusters.map((cluster, idx) => (
            <section key={cluster.id} className={`rounded-xl border-l-4 pl-4 ${CLUSTER_BORDER_COLORS[idx % CLUSTER_COLOR_COUNT]}`}>
              <h3 className="font-semibold text-pulse-900 dark:text-pulse-100">{cluster.label}</h3>
              <div className="mt-2 space-y-2">
                {ideasForCluster(activeIdeas, cluster.id).map((idea) => (
                  <IdeateIdeaCard
                    key={idea.id}
                    idea={idea}
                    variant="join"
                    upvoted={state.myUpvotes.includes(idea.id)}
                    canVote={dotsRemaining > 0}
                    onUpvote={upvote}
                    showCounts={state.rankingRevealed}
                    t={t}
                  />
                ))}
              </div>
            </section>
          ))
        )}
        {unclusteredIdeas(activeIdeas).map((idea) => (
          <IdeateIdeaCard
            key={idea.id}
            idea={idea}
            variant="join"
            upvoted={state.myUpvotes.includes(idea.id)}
            canVote={dotsRemaining > 0}
            onUpvote={upvote}
            showCounts={state.rankingRevealed}
            t={t}
          />
        ))}
      </div>
    </ParticipantShell>
  )
}
