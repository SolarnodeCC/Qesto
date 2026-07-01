// IDEATE facilitator board page (FE-IDEATE-BOARD-01).
//
// Route: /sessions/:id/ideate/board
//
// Full facilitator experience:
//   - Session config fetch (REST, draft/live detection)
//   - Start session CTA when in draft
//   - Live board via useIdeateSession (WebSocket, same hook as IdeatePresent)
//   - IdeateFacilitatorBoard component: dot-vote overlay, clustering, ranking, moderation
//
// Uses the existing useIdeateSession hook — no new WS transport.
// Reuses ideate locale namespace (existing keys + board.* additions).

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api, getAuthToken } from '../api/client'
import { useT } from '../i18n'
import { useIdeateSession } from '../hooks/useIdeateSession'
import { IdeateFacilitatorBoard } from '../ui/IdeateFacilitatorBoard'
import HostConsoleShell from '../layouts/HostConsoleShell'

type IdeateConfig = {
  sessionId: string
  title: string
  code: string
  status: string
  dotVoteLimit: number
}

export default function IdeateBoardPage() {
  const { id } = useParams<{ id: string }>()
  const presenterToken = getAuthToken() ?? undefined
  const t = useT('ideate')

  const [config, setConfig] = useState<IdeateConfig | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)

  const live = config?.status === 'live' || config?.status === 'energizing'

  const { state, upvote, revealRanking, dismiss, merge } = useIdeateSession(id, {
    enabled: !!id && live,
    ...(presenterToken ? { presenterToken } : {}),
  })

  const refreshConfig = useCallback(async () => {
    if (!id) return
    const res = await api<IdeateConfig>(`/api/sessions/${encodeURIComponent(id)}/ideate/config`)
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
    const res = await api(`/api/sessions/${encodeURIComponent(id)}/start`, { method: 'POST' })
    setStarting(false)
    if (!res.ok) {
      setStartError(res.error.message)
      return
    }
    await refreshConfig()
  }

  if (loadError) return <div className="p-8 text-center text-red-600">{loadError}</div>
  if (!config) return <div className="p-8 text-center text-pulse-500" aria-live="polite">…</div>

  const connectionLabel =
    live && state.connection !== 'open'
      ? state.connection === 'failed'
        ? t('connection.failed')
        : t('connection.reconnecting')
      : null

  return (
    <HostConsoleShell title={config.title} subtitle={t('board.subtitle')} connectionLabel={connectionLabel} maxWidth="6xl">
      {/* Draft start CTA */}
      {!live && (
        <section
          aria-labelledby="draft-cta-heading"
          className="rounded-lg border border-teal-200 bg-teal-50 p-5 dark:border-teal-800 dark:bg-teal-900/20"
        >
          <h2
            id="draft-cta-heading"
            className="mb-1 font-semibold text-teal-800 dark:text-teal-200"
          >
            {t('present.draftHint')}
          </h2>
          <button
            type="button"
            onClick={() => void handleStart()}
            disabled={starting}
            className="mt-3 min-h-[44px] rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-teal-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 disabled:opacity-50"
          >
            {starting ? t('present.starting') : t('present.start')}
          </button>
          {startError && (
            <p role="alert" className="mt-2 text-sm text-red-600">
              {startError}
            </p>
          )}
        </section>
      )}

      {/* Join URL */}
      {live && (
        <section className="rounded-lg border border-pulse-200 bg-pulse-50 p-4 dark:border-pulse-700 dark:bg-pulse-900/30">
          <p className="text-sm text-pulse-700 dark:text-pulse-300">
            {t('present.joinAt')}{' '}
            <span className="font-mono font-semibold">qesto.cc/i/{config.code}</span>
          </p>
          <p className="mt-1 text-xs text-pulse-500">
            {t('board.dotLimit', { limit: config.dotVoteLimit })}
          </p>
        </section>
      )}

      {/* Error from WS */}
      {live && state.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}

      {/* Main live board */}
      {live && (
        <IdeateFacilitatorBoard
          ideas={state.ideas}
          clusters={state.clusters}
          dotVoteLimit={state.dotVoteLimit}
          dotsUsed={state.dotsUsed}
          myUpvotes={state.myUpvotes}
          rankingRevealed={state.rankingRevealed}
          ranking={state.ranking}
          onUpvote={upvote}
          onDismiss={dismiss}
          onMerge={merge}
          onRevealRanking={revealRanking}
          t={t}
        />
      )}
    </HostConsoleShell>
  )
}
