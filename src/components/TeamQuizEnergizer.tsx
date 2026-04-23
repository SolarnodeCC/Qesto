// TeamQuizEnergizer — multi-question quiz energizer.
//
// Host (draft):  edit questions / options / correct answers → Start
// Host (active): current question + response count → Next / Close
// Host (completed): final scoreboard
// Participant (active): answer current question → running score
// Participant (completed): final rank

import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../api/client'

export type TeamQuizQuestion = {
  prompt: string
  options: string[]
  correct_index: number
}

export type TeamQuizEnergizer = {
  id: string
  kind: 'team_quiz'
  prompt: string
  config: {
    questions: TeamQuizQuestion[]
    current_index: number
  }
  state: 'draft' | 'active' | 'completed'
}

type Score = { voter_id: string; score: number; rank: number }

type Props = {
  sessionId: string
  energizer: TeamQuizEnergizer
  role: 'host' | 'participant'
  voterId?: string
  onActivate?: () => void
  onComplete?: () => void
}

export default function TeamQuizEnergizerView({
  sessionId,
  energizer,
  role,
  voterId,
  onActivate,
  onComplete,
}: Props) {
  const { id, state } = energizer

  // ── Host editing state (draft)
  const [questions, setQuestions] = useState<TeamQuizQuestion[]>([...energizer.config.questions])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // ── Live state (active/completed)
  const [currentIndex, setCurrentIndex] = useState(energizer.config.current_index)
  const [responseCount, setResponseCount] = useState(0)
  const [scores, setScores] = useState<Score[]>([])
  const [activating, setActivating] = useState(false)
  const [advancing, setAdvancing] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  // ── Participant voting
  const [myAnswers, setMyAnswers] = useState<Record<number, string>>({}) // qi -> value
  const [submitting, setSubmitting] = useState(false)
  const [voteError, setVoteError] = useState<string | null>(null)
  const [myScore, setMyScore] = useState(0)

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchLive = useCallback(async () => {
    const res = await api<{
      energizer: TeamQuizEnergizer
      response_count: number
      scores: Score[]
    }>(`/api/sessions/${encodeURIComponent(sessionId)}/energizers/active`)
    if (res.ok && res.data.energizer?.id === id) {
      setCurrentIndex(res.data.energizer.config.current_index)
      setResponseCount(res.data.response_count)
      setScores(res.data.scores)
      const me = res.data.scores.find((s) => s.voter_id === voterId)
      if (me) setMyScore(me.score)
    }
  }, [sessionId, id, voterId])

  useEffect(() => {
    if (state !== 'active') return
    fetchLive()
    pollRef.current = setInterval(fetchLive, 2000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [state, fetchLive])

  useEffect(() => {
    if (state !== 'completed') return
    // Fetch final scores via GET by id
    ;(async () => {
      const res = await api<{ scores: Score[] }>(
        `/api/sessions/${encodeURIComponent(sessionId)}/energizers/${encodeURIComponent(id)}`,
      )
      if (res.ok && res.data.scores) setScores(res.data.scores)
    })()
  }, [state, sessionId, id])

  function updateQuestion(qi: number, patch: Partial<TeamQuizQuestion>) {
    setQuestions((qs) => qs.map((q, i) => (i === qi ? { ...q, ...patch } : q)))
  }

  function updateOption(qi: number, oi: number, value: string) {
    setQuestions((qs) =>
      qs.map((q, i) =>
        i === qi ? { ...q, options: q.options.map((o, j) => (j === oi ? value : o)) } : q,
      ),
    )
  }

  function addQuestion() {
    setQuestions((qs) => [
      ...qs,
      { prompt: `Question ${qs.length + 1}`, options: ['Option A', 'Option B', 'Option C', 'Option D'], correct_index: 0 },
    ])
  }

  function removeQuestion(qi: number) {
    setQuestions((qs) => qs.filter((_, i) => i !== qi))
  }

  async function handleSave() {
    setSaving(true)
    setSaveError(null)
    const res = await api<{ state: string }>(
      `/api/sessions/${encodeURIComponent(sessionId)}/energizers/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: { config: { questions, current_index: -1 } } },
    )
    setSaving(false)
    if (!res.ok) setSaveError(res.error.message)
  }

  async function handleActivate() {
    setActivating(true)
    setActionError(null)
    const res = await api<{ state: string }>(
      `/api/sessions/${encodeURIComponent(sessionId)}/energizers/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        body: { state: 'active', config: { questions, current_index: 0 } },
      },
    )
    setActivating(false)
    if (res.ok) { setCurrentIndex(0); onActivate?.() }
    else setActionError(res.error.message)
  }

  async function handleNext() {
    setAdvancing(true)
    setActionError(null)
    const res = await api<{ current_index: number; state: string; done: boolean }>(
      `/api/sessions/${encodeURIComponent(sessionId)}/energizers/${encodeURIComponent(id)}/next`,
      { method: 'POST', body: {} },
    )
    setAdvancing(false)
    if (res.ok) {
      setCurrentIndex(res.data.current_index)
      if (res.data.done) onComplete?.()
      else fetchLive()
    } else {
      setActionError(res.error.message)
    }
  }

  async function handleVote(qi: number, option: string) {
    if (!voterId || submitting || myAnswers[qi] !== undefined) return
    setSubmitting(true)
    setVoteError(null)
    const res = await api<{ voted: string; correct: boolean }>(
      `/api/sessions/${encodeURIComponent(sessionId)}/energizers/${encodeURIComponent(id)}/vote`,
      { method: 'POST', body: { value: option, voter_id: voterId } },
    )
    setSubmitting(false)
    if (res.ok) {
      setMyAnswers((prev) => ({ ...prev, [qi]: option }))
      if (res.data.correct) setMyScore((s) => s + 1)
    } else {
      setVoteError(res.error.message)
    }
  }

  const totalQ = questions.length
  const currentQ = energizer.config.questions[currentIndex] as TeamQuizQuestion | undefined
  const myRank = scores.find((s) => s.voter_id === voterId)?.rank

  return (
    <div className="rounded-2xl border border-pulse-200 dark:border-pulse-700 bg-white dark:bg-pulse-900 p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-0.5">
          <p className="text-xs font-semibold uppercase tracking-wider text-orange-600">Team Quiz</p>
          <p className="font-semibold text-pulse-900 dark:text-pulse-100">{energizer.prompt}</p>
        </div>
        <span className={
          'text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ' +
          (state === 'active' ? 'bg-teal-100 text-teal-700' : state === 'completed' ? 'bg-pulse-100 text-pulse-500' : 'bg-amber-100 text-amber-700')
        }>{state}</span>
      </div>

      {/* ── HOST DRAFT: question editor ── */}
      {role === 'host' && state === 'draft' && (
        <div className="space-y-4">
          {questions.map((q, qi) => (
            <div key={qi} className="rounded-xl border border-pulse-200 dark:border-pulse-700 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-pulse-500 uppercase tracking-wider">Q{qi + 1}</span>
                {questions.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeQuestion(qi)}
                    className="text-xs text-red-400 hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 rounded"
                    aria-label={`Remove question ${qi + 1}`}
                  >
                    Remove
                  </button>
                )}
              </div>
              <input
                type="text"
                value={q.prompt}
                onChange={(e) => updateQuestion(qi, { prompt: e.target.value })}
                placeholder={`Question ${qi + 1}`}
                maxLength={280}
                className="w-full rounded-lg border border-pulse-300 dark:border-pulse-600 dark:bg-pulse-800 dark:text-pulse-100 px-3 py-1.5 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
              />
              <div className="grid grid-cols-2 gap-1.5">
                {q.options.map((opt, oi) => (
                  <div key={oi} className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => updateQuestion(qi, { correct_index: oi })}
                      aria-label={`Mark option ${oi + 1} correct`}
                      className={[
                        'w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-orange-500',
                        q.correct_index === oi ? 'border-teal-500 bg-teal-500' : 'border-pulse-300 dark:border-pulse-600',
                      ].join(' ')}
                    >
                      {q.correct_index === oi && (
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </button>
                    <input
                      type="text"
                      value={opt}
                      onChange={(e) => updateOption(qi, oi, e.target.value)}
                      maxLength={100}
                      placeholder={`Option ${oi + 1}`}
                      className="flex-1 min-w-0 rounded border border-pulse-300 dark:border-pulse-600 dark:bg-pulse-800 dark:text-pulse-100 px-2 py-1 text-xs focus:outline-none focus-visible:ring-1 focus-visible:ring-orange-500"
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}

          {questions.length < 10 && (
            <button
              type="button"
              onClick={addQuestion}
              className="text-sm text-orange-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 rounded"
            >
              + Add question
            </button>
          )}

          {saveError && <p className="text-sm text-red-600" role="alert">{saveError}</p>}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleActivate}
              disabled={activating || questions.some((q) => !q.prompt.trim() || q.options.filter(Boolean).length < 2)}
              className="px-4 py-2 rounded-lg bg-orange-600 text-white text-sm font-medium hover:bg-orange-700 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 transition-colors"
            >
              {activating ? 'Starting…' : `Start Quiz (${totalQ} questions)`}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-3 py-2 rounded-lg border border-pulse-300 dark:border-pulse-600 text-sm text-pulse-700 dark:text-pulse-300 hover:bg-pulse-50 dark:hover:bg-pulse-800 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-pulse-500 transition-colors"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {/* ── HOST ACTIVE ── */}
      {role === 'host' && state === 'active' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-pulse-500">
            <span>Question {Math.min(currentIndex + 1, totalQ)} of {totalQ}</span>
            <span>·</span>
            <span>{responseCount} answered</span>
          </div>
          {currentIndex >= 0 && currentIndex < totalQ && (
            <div className="rounded-xl bg-pulse-50 dark:bg-pulse-800 p-3 space-y-2">
              <p className="font-medium text-pulse-900 dark:text-pulse-100">{energizer.config.questions[currentIndex].prompt}</p>
              <div className="grid grid-cols-2 gap-1">
                {energizer.config.questions[currentIndex].options.map((opt, oi) => (
                  <div
                    key={oi}
                    className={[
                      'rounded-lg px-2 py-1.5 text-sm',
                      oi === energizer.config.questions[currentIndex].correct_index
                        ? 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 font-medium'
                        : 'text-pulse-600 dark:text-pulse-400',
                    ].join(' ')}
                  >
                    {opt} {oi === energizer.config.questions[currentIndex].correct_index && '✓'}
                  </div>
                ))}
              </div>
            </div>
          )}
          <ScoreBoard scores={scores} />
          {actionError && <p className="text-sm text-red-600" role="alert">{actionError}</p>}
          <button
            type="button"
            onClick={handleNext}
            disabled={advancing}
            className="px-4 py-2 rounded-lg bg-orange-600 text-white text-sm font-medium hover:bg-orange-700 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 transition-colors"
          >
            {advancing ? 'Advancing…' : currentIndex + 1 >= totalQ ? 'Finish Quiz' : 'Next Question →'}
          </button>
        </div>
      )}

      {/* ── HOST COMPLETED ── */}
      {role === 'host' && state === 'completed' && (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-pulse-700 dark:text-pulse-300">Final Results</p>
          <ScoreBoard scores={scores} showAll />
        </div>
      )}

      {/* ── PARTICIPANT WAITING (draft) ── */}
      {role === 'participant' && state === 'draft' && (
        <p className="text-sm text-center text-pulse-400">Waiting for the quiz to start…</p>
      )}

      {/* ── PARTICIPANT ACTIVE ── */}
      {role === 'participant' && state === 'active' && currentIndex >= 0 && currentIndex < totalQ && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-pulse-500">
            <span>Question {currentIndex + 1} of {totalQ}</span>
            <span>Score: <span className="font-bold text-orange-600">{myScore}</span></span>
          </div>
          <p className="font-medium text-pulse-900 dark:text-pulse-100">{currentQ?.prompt}</p>
          <div className="grid grid-cols-2 gap-2">
            {(currentQ?.options ?? []).map((opt, oi) => {
              const answered = myAnswers[currentIndex] !== undefined
              const isMyAnswer = myAnswers[currentIndex] === opt
              const isCorrect = oi === currentQ?.correct_index
              return (
                <button
                  key={oi}
                  type="button"
                  onClick={() => handleVote(currentIndex, opt)}
                  disabled={answered || submitting}
                  aria-pressed={isMyAnswer}
                  className={[
                    'rounded-xl border-2 px-3 py-3 text-sm font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500',
                    answered
                      ? isMyAnswer
                        ? isCorrect
                          ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/30 text-teal-700'
                          : 'border-red-400 bg-red-50 dark:bg-red-900/20 text-red-600'
                        : isCorrect
                        ? 'border-teal-300 bg-teal-50/50 dark:bg-teal-900/10 text-teal-600'
                        : 'border-pulse-200 dark:border-pulse-700 text-pulse-400 opacity-60'
                      : 'border-pulse-200 dark:border-pulse-700 text-pulse-900 dark:text-pulse-100 hover:border-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/10 active:scale-95 cursor-pointer',
                  ].join(' ')}
                >
                  {opt}
                </button>
              )
            })}
          </div>
          {voteError && <p className="text-sm text-red-600" role="alert">{voteError}</p>}
          {myAnswers[currentIndex] !== undefined && (
            <p className="text-sm text-center text-pulse-400" role="status">
              {myAnswers[currentIndex] === currentQ?.options[currentQ.correct_index]
                ? '✓ Correct! Waiting for next question…'
                : '✗ Not quite — waiting for next question…'}
            </p>
          )}
        </div>
      )}

      {/* ── PARTICIPANT COMPLETED ── */}
      {role === 'participant' && state === 'completed' && (
        <div className="space-y-3">
          <div className="text-center space-y-1">
            <p className="text-3xl font-bold text-orange-600">{myScore}/{totalQ}</p>
            <p className="text-sm text-pulse-500">
              {myRank ? `Rank #${myRank}` : 'Quiz complete!'}
            </p>
          </div>
          <ScoreBoard scores={scores} {...(voterId !== undefined ? { voterId } : {})} showAll />
        </div>
      )}
    </div>
  )
}

function ScoreBoard({
  scores,
  voterId,
  showAll = false,
}: {
  scores: Score[]
  voterId?: string
  showAll?: boolean
}) {
  if (scores.length === 0) return null
  const top = showAll ? scores : scores.slice(0, 5)
  return (
    <ol className="space-y-1" aria-label="Scoreboard">
      {top.map((s) => {
        const isMe = s.voter_id === voterId
        return (
          <li
            key={s.voter_id}
            className={[
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm',
              isMe ? 'bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800' : 'bg-pulse-50 dark:bg-pulse-800',
            ].join(' ')}
          >
            <span className="w-5 text-xs font-bold text-pulse-400 tabular-nums">{s.rank}.</span>
            <span className="flex-1 truncate text-pulse-700 dark:text-pulse-300">
              {isMe ? 'You' : `Player ${s.rank}`}
            </span>
            <span className="font-bold tabular-nums text-orange-600">{s.score}</span>
          </li>
        )
      })}
    </ol>
  )
}
