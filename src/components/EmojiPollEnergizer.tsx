// EmojiPollEnergizer — renders emoji mood-check for host (with live results)
// and participants (with voting capability).

import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../api/client'

export type EmojiPollEnergizer = {
  id: string
  kind: 'emoji_poll'
  prompt: string
  config: { emojis: string[] }
  state: 'draft' | 'active' | 'completed'
}

type Props = {
  sessionId: string
  energizer: EmojiPollEnergizer
  role: 'host' | 'participant'
  voterId?: string
  onActivate?: () => void
  onComplete?: () => void
}

export default function EmojiPollEnergizerView({
  sessionId,
  energizer,
  role,
  voterId,
  onActivate,
  onComplete,
}: Props) {
  const { id, prompt, config, state } = energizer
  const emojis = config.emojis

  const [results, setResults] = useState<Record<string, number>>(() =>
    Object.fromEntries(emojis.map((e) => [e, 0])),
  )
  const [myVote, setMyVote] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [activating, setActivating] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchResults = useCallback(async () => {
    const res = await api<{ energizer: EmojiPollEnergizer | null; results: Record<string, number> }>(
      `/api/sessions/${encodeURIComponent(sessionId)}/energizers/active`,
    )
    if (res.ok && res.data.energizer?.id === id) {
      setResults(res.data.results)
    }
  }, [sessionId, id])

  // Poll for live results when active
  useEffect(() => {
    if (state !== 'active') return
    fetchResults()
    pollRef.current = setInterval(fetchResults, 2000)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [state, fetchResults])

  // Fetch final results when completed
  useEffect(() => {
    if (state !== 'completed') return
    fetchResults()
  }, [state, fetchResults])

  async function handleVote(emoji: string) {
    if (!voterId || submitting || myVote !== null) return
    setSubmitting(true)
    setError(null)
    const res = await api<{ voted: string }>(
      `/api/sessions/${encodeURIComponent(sessionId)}/energizers/${encodeURIComponent(id)}/vote`,
      { method: 'POST', body: { value: emoji, voter_id: voterId } },
    )
    setSubmitting(false)
    if (res.ok) {
      setMyVote(emoji)
      fetchResults()
    } else {
      setError(res.error.message)
    }
  }

  async function handleActivate() {
    setActivating(true)
    setError(null)
    const res = await api<{ state: string }>(
      `/api/sessions/${encodeURIComponent(sessionId)}/energizers/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: { state: 'active' } },
    )
    setActivating(false)
    if (res.ok) onActivate?.()
    else setError(res.error.message)
  }

  async function handleComplete() {
    setCompleting(true)
    setError(null)
    const res = await api<{ state: string }>(
      `/api/sessions/${encodeURIComponent(sessionId)}/energizers/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: { state: 'completed' } },
    )
    setCompleting(false)
    if (res.ok) onComplete?.()
    else setError(res.error.message)
  }

  const total = Object.values(results).reduce((s, n) => s + n, 0)
  const max = Math.max(...Object.values(results), 1)

  return (
    <div className="rounded-2xl border border-pulse-200 dark:border-pulse-700 bg-white dark:bg-pulse-900 p-6 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-0.5">
          <p className="text-xs font-semibold uppercase tracking-wider text-teal-600">Emoji Poll</p>
          <p className="font-semibold text-pulse-900 dark:text-pulse-100">{prompt}</p>
        </div>
        <span
          className={
            'text-xs px-2 py-0.5 rounded-full font-medium ' +
            (state === 'active'
              ? 'bg-teal-100 text-teal-700'
              : state === 'completed'
              ? 'bg-pulse-100 text-pulse-500'
              : 'bg-amber-100 text-amber-700')
          }
        >
          {state}
        </span>
      </div>

      {/* Emoji grid — participant voting or host results */}
      <div className="grid grid-cols-5 gap-2" role="group" aria-label="Emoji choices">
        {emojis.map((emoji) => {
          const count = results[emoji] ?? 0
          const pct = total === 0 ? 0 : Math.round((count / total) * 100)
          const isVoted = myVote === emoji
          const isLeading = count === max && max > 0 && state !== 'draft'

          return (
            <button
              key={emoji}
              type="button"
              disabled={
                role === 'host' ||
                state !== 'active' ||
                submitting ||
                myVote !== null
              }
              onClick={() => handleVote(emoji)}
              aria-label={`${emoji}${count > 0 ? `, ${count} vote${count !== 1 ? 's' : ''}` : ''}`}
              aria-pressed={isVoted}
              className={[
                'flex flex-col items-center gap-1 rounded-xl p-2 border transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500',
                role === 'participant' && state === 'active' && myVote === null
                  ? 'cursor-pointer hover:border-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/20'
                  : 'cursor-default',
                isVoted ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/30' : 'border-pulse-200 dark:border-pulse-700',
                isLeading && state === 'completed' ? 'border-violet-400 bg-violet-50 dark:bg-violet-900/20' : '',
              ].join(' ')}
            >
              <span className="text-2xl leading-none" aria-hidden="true">{emoji}</span>
              {state !== 'draft' && (
                <span className="text-xs font-medium tabular-nums text-pulse-600 dark:text-pulse-300">
                  {pct}%
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Bar chart for host or after voting */}
      {(role === 'host' || myVote !== null) && state !== 'draft' && (
        <div className="space-y-1.5" aria-label="Vote distribution">
          {emojis.map((emoji) => {
            const count = results[emoji] ?? 0
            const pct = total === 0 ? 0 : Math.round((count / total) * 100)
            const barWidth = max === 0 ? 0 : Math.round((count / max) * 100)
            return (
              <div key={emoji} className="flex items-center gap-2 text-sm">
                <span className="w-8 text-center" aria-hidden="true">{emoji}</span>
                <div className="flex-1 h-2 bg-pulse-100 dark:bg-pulse-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-teal-400 to-violet-400 transition-[width] duration-500"
                    style={{ width: `${barWidth}%` }}
                    role="presentation"
                  />
                </div>
                <span className="w-16 text-right text-pulse-500 tabular-nums">{count} · {pct}%</span>
              </div>
            )
          })}
          <p className="text-xs text-pulse-500 text-right">{total} response{total !== 1 ? 's' : ''}</p>
        </div>
      )}

      {/* Participant: voted confirmation */}
      {role === 'participant' && myVote !== null && (
        <p className="text-sm text-center text-teal-600 font-medium" role="status">
          You voted {myVote} — thanks!
        </p>
      )}

      {/* Participant: waiting state */}
      {role === 'participant' && state === 'draft' && (
        <p className="text-sm text-center text-pulse-500">Waiting for the host to start the energizer…</p>
      )}

      {/* Host controls */}
      {role === 'host' && (
        <div className="flex gap-2 pt-1">
          {state === 'draft' && (
            <button
              type="button"
              onClick={handleActivate}
              disabled={activating}
              className="px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 transition-colors"
            >
              {activating ? 'Starting…' : 'Start Emoji Poll'}
            </button>
          )}
          {state === 'active' && (
            <button
              type="button"
              onClick={handleComplete}
              disabled={completing}
              className="px-4 py-2 rounded-lg bg-pulse-800 text-white text-sm font-medium hover:bg-pulse-900 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-pulse-500 transition-colors"
            >
              {completing ? 'Closing…' : 'Close Poll'}
            </button>
          )}
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600" role="alert">{error}</p>
      )}
    </div>
  )
}
