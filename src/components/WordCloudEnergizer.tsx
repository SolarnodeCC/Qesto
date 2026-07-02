// WordCloudEnergizer — participants type one word; host sees a live word cloud.
//
// Host (draft):  Start button
// Host (active): live word cloud (font-size by frequency) → Close
// Host (completed): final word cloud
// Participant (active): single-word input → Submit → see cloud
// Participant (completed): see final cloud

import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../api/client'
import { inputHint } from '../ui/input-hint'

export type WordCloudEnergizer = {
  id: string
  kind: 'word_cloud'
  prompt: string
  config: { max_words_per_participant: number }
  state: 'draft' | 'active' | 'completed'
}

type Props = {
  sessionId: string
  energizer: WordCloudEnergizer
  role: 'host' | 'participant'
  voterId?: string
  onActivate?: () => void
  onComplete?: () => void
}

const COLORS = [
  'text-teal-600 dark:text-teal-400',
  'text-violet-600 dark:text-violet-400',
  'text-orange-500 dark:text-orange-400',
  'text-pink-500 dark:text-pink-400',
  'text-blue-600 dark:text-blue-400',
  'text-emerald-600 dark:text-emerald-400',
  'text-amber-600 dark:text-amber-400',
  'text-rose-500 dark:text-rose-400',
]

function hashColor(word: string): string {
  let h = 0
  for (let i = 0; i < word.length; i++) h = (h * 31 + word.charCodeAt(i)) & 0xffff
  return COLORS[h % COLORS.length]
}

export default function WordCloudEnergizerView({
  sessionId,
  energizer,
  role,
  voterId,
  onActivate,
  onComplete,
}: Props) {
  const { id, prompt, state } = energizer

  const [words, setWords] = useState<Record<string, number>>({})
  const [wordInput, setWordInput] = useState('')
  const [myWord, setMyWord] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [voteError, setVoteError] = useState<string | null>(null)
  const [activating, setActivating] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchWords = useCallback(async () => {
    const res = await api<{ energizer: WordCloudEnergizer | null; words: Record<string, number> }>(
      `/api/sessions/${encodeURIComponent(sessionId)}/energizers/active`,
    )
    if (res.ok && res.data.energizer?.id === id && res.data.words) {
      setWords(res.data.words)
    }
  }, [sessionId, id])

  useEffect(() => {
    if (state !== 'active') return
    fetchWords()
    pollRef.current = setInterval(fetchWords, 2000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [state, fetchWords])

  useEffect(() => {
    if (state !== 'completed') return
    ;(async () => {
      const res = await api<{ words: Record<string, number> }>(
        `/api/sessions/${encodeURIComponent(sessionId)}/energizers/${encodeURIComponent(id)}`,
      )
      if (res.ok && res.data.words) setWords(res.data.words)
    })()
  }, [state, sessionId, id])

  async function handleActivate() {
    setActivating(true)
    setActionError(null)
    const res = await api<{ state: string }>(
      `/api/sessions/${encodeURIComponent(sessionId)}/energizers/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: { state: 'active' } },
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const word = wordInput.trim().toLowerCase()
    if (!word || !voterId || submitting || myWord !== null) return
    if (/\s/.test(word)) { setVoteError('One word only — no spaces'); return }
    setSubmitting(true)
    setVoteError(null)
    const res = await api<{ voted: string }>(
      `/api/sessions/${encodeURIComponent(sessionId)}/energizers/${encodeURIComponent(id)}/vote`,
      { method: 'POST', body: { value: word, voter_id: voterId } },
    )
    setSubmitting(false)
    if (res.ok) {
      setMyWord(word)
      setWordInput('')
      fetchWords()
    } else {
      setVoteError(res.error.message)
    }
  }

  const total = Object.values(words).reduce((s, n) => s + n, 0)
  const maxCount = Math.max(...Object.values(words), 1)

  // Font size: 14px (count=1) → 42px (count=maxCount)
  function fontSize(count: number): number {
    const ratio = maxCount > 1 ? (count - 1) / (maxCount - 1) : 0
    return Math.round(14 + ratio * 28)
  }

  const sortedWords = Object.entries(words).sort((a, b) => b[1] - a[1])

  return (
    <div className="rounded-xl border border-pulse-200 dark:border-pulse-700 bg-white dark:bg-pulse-900 p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-0.5">
          <p className="text-xs font-semibold uppercase tracking-wider text-pink-600">Word Cloud</p>
          <p className="font-semibold text-pulse-900 dark:text-pulse-100">{prompt}</p>
        </div>
        <span className={
          'text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ' +
          (state === 'active' ? 'bg-teal-100 text-teal-700' : state === 'completed' ? 'bg-pulse-100 text-pulse-500' : 'bg-amber-100 text-amber-700')
        }>{state}</span>
      </div>

      {/* Word cloud display (active or completed, or after participant voted) */}
      {(state !== 'draft' || (role === 'participant' && myWord !== null)) && sortedWords.length > 0 && (
        <div
          className="min-h-24 flex flex-wrap gap-x-3 gap-y-1 items-baseline justify-center py-3"
          aria-label="Word cloud"
          role="img"
        >
          {sortedWords.map(([word, count]) => (
            <span
              key={word}
              style={{ fontSize: `${fontSize(count)}px` }}
              className={[
                'font-bold leading-tight transition-all duration-500',
                hashColor(word),
                word === myWord ? 'underline underline-offset-2' : '',
              ].join(' ')}
              title={`${word}: ${count}`}
              aria-label={`${word}, ${count} submission${count !== 1 ? 's' : ''}`}
            >
              {word}
            </span>
          ))}
        </div>
      )}

      {/* Empty state */}
      {state === 'active' && sortedWords.length === 0 && (
        <div className="min-h-16 flex items-center justify-center">
          <p className="text-sm text-pulse-500 animate-pulse">Waiting for words…</p>
        </div>
      )}

      {state !== 'draft' && total > 0 && (
        <p className="text-xs text-pulse-500 text-right">{total} word{total !== 1 ? 's' : ''} submitted</p>
      )}

      {/* ── HOST CONTROLS ── */}
      {role === 'host' && state === 'draft' && (
        <div className="space-y-2">
          {actionError && <p className="text-sm text-red-600" role="alert">{actionError}</p>}
          <button
            type="button"
            onClick={handleActivate}
            disabled={activating}
            className="px-4 py-2 rounded-lg bg-pink-600 text-white text-sm font-medium hover:bg-pink-700 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-500 transition-colors"
          >
            {activating ? 'Starting…' : 'Start Word Cloud'}
          </button>
        </div>
      )}
      {role === 'host' && state === 'active' && (
        <div className="space-y-2">
          {actionError && <p className="text-sm text-red-600" role="alert">{actionError}</p>}
          <button
            type="button"
            onClick={handleComplete}
            disabled={completing}
            className="px-4 py-2 rounded-lg bg-pulse-800 text-white text-sm font-medium hover:bg-pulse-900 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-pulse-500 transition-colors"
          >
            {completing ? 'Closing…' : 'Close Word Cloud'}
          </button>
        </div>
      )}

      {/* ── PARTICIPANT DRAFT ── */}
      {role === 'participant' && state === 'draft' && (
        <p className="text-sm text-center text-pulse-500">Waiting for the word cloud to start…</p>
      )}

      {/* ── PARTICIPANT ACTIVE: word input ── */}
      {role === 'participant' && state === 'active' && myWord === null && (
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={wordInput}
              onChange={(e) => setWordInput(e.target.value.replace(/\s/g, ''))}
              {...inputHint("Type one word…")}
              maxLength={40}
              autoFocus
              className="flex-1 rounded-xl border-2 border-pulse-200 dark:border-pulse-700 dark:bg-pulse-800 dark:text-pulse-100 px-4 py-3 text-base focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-500 focus:border-pink-400"
            />
            <button
              type="submit"
              disabled={submitting || !wordInput.trim()}
              className="px-5 py-3 rounded-xl bg-pink-600 text-white font-semibold hover:bg-pink-700 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-500 transition-colors"
            >
              {submitting ? '…' : 'Send'}
            </button>
          </div>
          {voteError && <p className="text-sm text-red-600" role="alert">{voteError}</p>}
        </form>
      )}

      {/* ── PARTICIPANT: after voting ── */}
      {role === 'participant' && myWord !== null && state === 'active' && (
        <p className="text-sm text-center text-pink-600 font-medium" role="status">
          You submitted: <span className="font-bold">"{myWord}"</span>
        </p>
      )}
    </div>
  )
}
