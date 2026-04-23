// QuickFingerEnergizer — speed-based quiz: first correct answer wins.
//
// Host view (draft):  edit question, options, correct answer → Start
// Host view (active): live leaderboard of who answered + speed
// Host view (completed): final rankings, winner highlighted
// Participant view (active): tap answer as fast as possible
// Participant view (completed): show result + winner

import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../api/client'

export type QuickFingerEnergizer = {
  id: string
  kind: 'quick_finger'
  prompt: string
  config: {
    options: string[]
    correct_index: number
  }
  state: 'draft' | 'active' | 'completed'
}

type Ranking = {
  voter_id: string
  value: string
  correct: boolean
  speed_ms: number
  rank: number
}

type Props = {
  sessionId: string
  energizer: QuickFingerEnergizer
  role: 'host' | 'participant'
  voterId?: string
  onActivate?: () => void
  onComplete?: () => void
}

export default function QuickFingerEnergizerView({
  sessionId,
  energizer,
  role,
  voterId,
  onActivate,
  onComplete,
}: Props) {
  const { id, state } = energizer

  // Editable config (host, draft only)
  const [editPrompt, setEditPrompt] = useState(energizer.prompt)
  const [editOptions, setEditOptions] = useState<string[]>([...energizer.config.options])
  const [editCorrect, setEditCorrect] = useState(energizer.config.correct_index)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Live rankings (polled while active/completed)
  const [rankings, setRankings] = useState<Ranking[]>([])
  const [activating, setActivating] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  // Participant voting
  const [myVote, setMyVote] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [voteError, setVoteError] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef<number>(Date.now())

  const fetchRankings = useCallback(async () => {
    const res = await api<{
      energizer: QuickFingerEnergizer | null
      rankings: Ranking[]
    }>(`/api/sessions/${encodeURIComponent(sessionId)}/energizers/active`)
    if (res.ok && res.data.energizer?.id === id && res.data.rankings) {
      setRankings(res.data.rankings)
    }
  }, [sessionId, id])

  // Poll rankings while active
  useEffect(() => {
    if (state !== 'active') return
    startTimeRef.current = Date.now()
    fetchRankings()
    pollRef.current = setInterval(fetchRankings, 1500)

    // Elapsed timer for participants
    if (role === 'participant') {
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000))
      }, 1000)
    }

    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [state, fetchRankings, role])

  // Fetch final rankings on complete
  useEffect(() => {
    if (state !== 'completed') return
    fetchRankings()
  }, [state, fetchRankings])

  async function handleSaveConfig() {
    setSaving(true)
    setSaveError(null)
    const res = await api<{ state: string }>(
      `/api/sessions/${encodeURIComponent(sessionId)}/energizers/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        body: {
          prompt: editPrompt.trim(),
          config: { options: editOptions, correct_index: editCorrect },
        },
      },
    )
    setSaving(false)
    if (!res.ok) setSaveError(res.error.message)
  }

  async function handleActivate() {
    // Save latest config first, then activate
    setActivating(true)
    setActionError(null)
    const res = await api<{ state: string }>(
      `/api/sessions/${encodeURIComponent(sessionId)}/energizers/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        body: {
          state: 'active',
          prompt: editPrompt.trim(),
          config: { options: editOptions, correct_index: editCorrect },
        },
      },
    )
    setActivating(false)
    if (res.ok) onActivate?.()
    else setActionError(res.error.message)
  }

  async function handleComplete() {
    setCompleting(true)
    setActionError(null)
    const res = await api<{ state: string }>(
      `/api/sessions/${encodeURIComponent(sessionId)}/energizers/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: { state: 'completed' } },
    )
    setCompleting(false)
    if (res.ok) onComplete?.()
    else setActionError(res.error.message)
  }

  async function handleVote(option: string) {
    if (!voterId || submitting || myVote !== null) return
    setSubmitting(true)
    setVoteError(null)
    const res = await api<{ voted: string }>(
      `/api/sessions/${encodeURIComponent(sessionId)}/energizers/${encodeURIComponent(id)}/vote`,
      { method: 'POST', body: { value: option, voter_id: voterId } },
    )
    setSubmitting(false)
    if (res.ok) {
      setMyVote(option)
      fetchRankings()
    } else {
      setVoteError(res.error.message)
    }
  }

  const correctAnswer = energizer.config.options[energizer.config.correct_index]
  const winner = rankings.filter((r) => r.correct).sort((a, b) => a.speed_ms - b.speed_ms)[0]
  const myRanking = rankings.find((r) => r.voter_id === voterId)

  function formatMs(ms: number): string {
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(2)}s`
  }

  return (
    <div className="rounded-2xl border border-pulse-200 dark:border-pulse-700 bg-white dark:bg-pulse-900 p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-0.5">
          <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">Quick Finger</p>
          <p className="font-semibold text-pulse-900 dark:text-pulse-100">
            {state === 'draft' && role === 'host' ? editPrompt || 'Enter your question…' : energizer.prompt}
          </p>
        </div>
        <span
          className={
            'text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ' +
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

      {/* ── HOST: Draft — config editor ── */}
      {role === 'host' && state === 'draft' && (
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-pulse-500 uppercase tracking-wider">Question</label>
            <textarea
              value={editPrompt}
              onChange={(e) => setEditPrompt(e.target.value)}
              rows={2}
              maxLength={280}
              placeholder="What is the capital of France?"
              className="w-full rounded-lg border border-pulse-300 dark:border-pulse-600 dark:bg-pulse-800 dark:text-pulse-100 px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 resize-none"
            />
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-pulse-500 uppercase tracking-wider">Options (tap correct)</p>
            {editOptions.map((opt, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditCorrect(idx)}
                  aria-label={`Mark option ${idx + 1} as correct`}
                  className={[
                    'w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500',
                    editCorrect === idx
                      ? 'border-teal-500 bg-teal-500'
                      : 'border-pulse-300 dark:border-pulse-600',
                  ].join(' ')}
                >
                  {editCorrect === idx && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
                <input
                  type="text"
                  value={opt}
                  onChange={(e) => {
                    const next = [...editOptions]
                    next[idx] = e.target.value
                    setEditOptions(next)
                  }}
                  maxLength={120}
                  placeholder={`Option ${idx + 1}`}
                  className="flex-1 rounded-lg border border-pulse-300 dark:border-pulse-600 dark:bg-pulse-800 dark:text-pulse-100 px-3 py-1.5 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                />
              </div>
            ))}
            {editOptions.length < 6 && (
              <button
                type="button"
                onClick={() => setEditOptions([...editOptions, ''])}
                className="text-xs text-violet-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 rounded"
              >
                + Add option
              </button>
            )}
          </div>

          {saveError && <p className="text-sm text-red-600" role="alert">{saveError}</p>}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleActivate}
              disabled={activating || !editPrompt.trim() || editOptions.filter(Boolean).length < 2}
              className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 transition-colors"
            >
              {activating ? 'Starting…' : 'Start Quick Finger'}
            </button>
            <button
              type="button"
              onClick={handleSaveConfig}
              disabled={saving}
              className="px-3 py-2 rounded-lg border border-pulse-300 dark:border-pulse-600 text-sm text-pulse-700 dark:text-pulse-300 hover:bg-pulse-50 dark:hover:bg-pulse-800 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-pulse-500 transition-colors"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {/* ── HOST: Active — live rankings ── */}
      {role === 'host' && state === 'active' && (
        <div className="space-y-3">
          <p className="text-xs font-medium text-pulse-500">
            Correct answer: <span className="text-teal-600 font-semibold">{correctAnswer}</span>
          </p>
          <LiveRankings rankings={rankings} formatMs={formatMs} />
          {actionError && <p className="text-sm text-red-600" role="alert">{actionError}</p>}
          <button
            type="button"
            onClick={handleComplete}
            disabled={completing}
            className="px-4 py-2 rounded-lg bg-pulse-800 text-white text-sm font-medium hover:bg-pulse-900 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-pulse-500 transition-colors"
          >
            {completing ? 'Closing…' : 'Close Question'}
          </button>
        </div>
      )}

      {/* ── HOST: Completed — final results ── */}
      {role === 'host' && state === 'completed' && (
        <div className="space-y-3">
          {winner && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800">
              <span className="text-2xl" aria-hidden="true">🏆</span>
              <div>
                <p className="text-sm font-semibold text-teal-800 dark:text-teal-200">
                  Winner — {formatMs(winner.speed_ms)}
                </p>
                <p className="text-xs text-teal-600">Answered: {winner.value}</p>
              </div>
            </div>
          )}
          <p className="text-xs font-medium text-pulse-500">
            Correct answer: <span className="text-teal-600 font-semibold">{correctAnswer}</span>
          </p>
          <LiveRankings rankings={rankings} formatMs={formatMs} />
        </div>
      )}

      {/* ── PARTICIPANT: Waiting (draft) ── */}
      {role === 'participant' && state === 'draft' && (
        <p className="text-sm text-center text-pulse-400">Waiting for the host to start the question…</p>
      )}

      {/* ── PARTICIPANT: Active — answer fast! ── */}
      {role === 'participant' && state === 'active' && myVote === null && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-pulse-500">Be the fastest!</p>
            <span className="font-mono text-lg font-bold text-violet-600 tabular-nums" aria-live="polite">
              {elapsed}s
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {energizer.config.options.map((opt, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleVote(opt)}
                disabled={submitting}
                className="rounded-xl border-2 border-pulse-200 dark:border-pulse-700 px-3 py-4 text-sm font-medium text-pulse-900 dark:text-pulse-100 hover:border-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20 active:scale-95 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
              >
                {opt}
              </button>
            ))}
          </div>
          {voteError && <p className="text-sm text-red-600" role="alert">{voteError}</p>}
        </div>
      )}

      {/* ── PARTICIPANT: After voting ── */}
      {role === 'participant' && state === 'active' && myVote !== null && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-center" role="status">
            {myVote === correctAnswer ? (
              <span className="text-teal-600">✓ Correct! Waiting for results…</span>
            ) : (
              <span className="text-red-500">✗ Not quite — the correct answer is {correctAnswer}</span>
            )}
          </p>
          <LiveRankings rankings={rankings} formatMs={formatMs} {...(voterId !== undefined ? { voterId } : {})} />
        </div>
      )}

      {/* ── PARTICIPANT: Completed ── */}
      {role === 'participant' && state === 'completed' && (
        <div className="space-y-3">
          {myRanking?.correct && myRanking.rank === 1 && (
            <div className="text-center space-y-1">
              <div className="text-4xl" aria-hidden="true">🏆</div>
              <p className="font-semibold text-teal-600">You were first! ({formatMs(myRanking.speed_ms)})</p>
            </div>
          )}
          {myRanking && !myRanking.correct && (
            <p className="text-sm text-center text-pulse-500">
              Correct answer was <span className="font-semibold text-teal-600">{correctAnswer}</span>
            </p>
          )}
          <LiveRankings rankings={rankings} formatMs={formatMs} {...(voterId !== undefined ? { voterId } : {})} />
        </div>
      )}
    </div>
  )
}

function LiveRankings({
  rankings,
  formatMs,
  voterId,
}: {
  rankings: Ranking[]
  formatMs: (ms: number) => string
  voterId?: string
}) {
  if (rankings.length === 0) {
    return <p className="text-sm text-pulse-400 text-center">No answers yet…</p>
  }

  const sorted = [...rankings].sort((a, b) => {
    if (a.correct !== b.correct) return a.correct ? -1 : 1
    return a.speed_ms - b.speed_ms
  })

  return (
    <ol className="space-y-1" aria-label="Speed rankings">
      {sorted.map((r, i) => {
        const isMe = r.voter_id === voterId
        return (
          <li
            key={r.voter_id}
            className={[
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm',
              isMe ? 'bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800' : 'bg-pulse-50 dark:bg-pulse-800',
            ].join(' ')}
          >
            <span className="w-5 text-xs font-bold text-pulse-400 tabular-nums">{i + 1}.</span>
            <span
              className={[
                'flex-1 truncate font-medium',
                r.correct ? 'text-teal-700 dark:text-teal-300' : 'text-red-500 line-through',
              ].join(' ')}
            >
              {r.value}
              {isMe && <span className="ml-1 text-xs text-pulse-400">(you)</span>}
            </span>
            <span className="text-xs tabular-nums text-pulse-500">{formatMs(r.speed_ms)}</span>
            {r.correct && r.rank === 1 && <span aria-hidden="true">🏆</span>}
          </li>
        )
      })}
    </ol>
  )
}
