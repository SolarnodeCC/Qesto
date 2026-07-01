import { Check, ThumbsUp } from 'lucide-react'
import { useT } from '../../i18n'
import { inputHint } from '../../ui/input-hint'
import { ENTRY_RESPONSE_FIELD_CLASS } from '../../ui/input-field-class'
import { concatClasses } from '../../lib/concat-classes'
import { SliderInput } from './LiveEnergizerPanels'
import type { LivePollOption } from '../../hooks/useLiveSession'

interface QuestionVoteInputProps {
  questionKind: string
  hasVoted: boolean
  canVote: boolean
  myVotes: string[]
  options: LivePollOption[]
  results: { counts: Record<string, number>; total: number }
  onVote: (optionId: string) => void
  onReaction?: (emojiId: string) => void
}

export function QuestionVoteInput({
  questionKind,
  hasVoted,
  canVote,
  myVotes,
  options,
  results,
  onVote,
  onReaction,
}: QuestionVoteInputProps) {
  const t = useT('jo' + 'in')
  const qk = questionKind

  /* ── Live reactions (ADR-0055) ─────────────────────────────────── */
  if (qk === 'reaction') {
    return (
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2" role="group" aria-label={t('reactions_group')}>
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => canVote && onReaction?.(o.id)}
            disabled={!canVote}
            aria-label={o.label}
            className="flex flex-col items-center gap-1 rounded-xl border border-pulse-200 dark:border-[var(--color-border)] bg-white dark:bg-[var(--color-surface-elevated)] py-4 text-3xl transition-transform hover:scale-105 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 disabled:opacity-50"
          >
            <span aria-hidden="true">{o.id}</span>
            <span className="caption text-pulse-500">{results.counts[o.id] ?? 0}</span>
          </button>
        ))}
      </div>
    )
  }

  /* ── Word cloud / Open text ─────────────────────────────────────── */
  if (qk === 'word_cloud' || qk === 'open') {
    if (hasVoted) {
      return (
        <p role="status" aria-live="polite" className="flex items-center gap-2 text-sm font-medium text-teal-700 dark:text-teal-400">
          <Check size={16} aria-hidden="true" />
          {t('vote_recorded')}
        </p>
      )
    }
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault()
          const inp = e.currentTarget.elements.namedItem('resp')
          const val = inp instanceof HTMLInputElement ? inp.value.trim() : ''
          if (!val || !canVote) return
          onVote(val)
        }}
        className="space-y-2"
      >
        <input
          type="text"
          name="resp"
          disabled={!canVote}
          maxLength={120}
          {...inputHint(qk === 'word_cloud' ? t('word_phrase_hint') : t('response_hint'))}
          className={ENTRY_RESPONSE_FIELD_CLASS}
          autoComplete="off"
        />
        <button
          type="submit"
          disabled={!canVote}
          className="w-full rounded-xl bg-teal-600 text-white py-2.5 text-sm font-medium hover:brightness-110 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
        >
          {t('submit')}
        </button>
      </form>
    )
  }

  /* ── Likert scale ──────────────────────────────────────────────── */
  if (qk === 'likert') {
    return (
      <div className="grid grid-cols-5 gap-1.5">
        {options.map((o) => {
          const voted = myVotes.includes(o.id)
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => !hasVoted && canVote && onVote(o.id)}
              disabled={hasVoted || !canVote}
              aria-pressed={voted}
              className={concatClasses(
                'flex flex-col items-center gap-1 rounded-lg border py-3 px-1 text-xs font-medium text-center transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500',
                voted
                  ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/30 text-teal-800 dark:text-teal-300'
                  : hasVoted
                  ? 'border-pulse-200 dark:border-[var(--color-border)] text-pulse-500 dark:text-[var(--text-muted)] cursor-default'
                  : 'border-pulse-200 dark:border-[var(--color-border)] bg-white dark:bg-[var(--color-surface-elevated)] text-pulse-700 dark:text-[var(--text-secondary)] hover:border-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/20',
                !canVote && 'opacity-50 cursor-not-allowed',
              )}
            >
              {o.label}
            </button>
          )
        })}
      </div>
    )
  }

  /* ── Slider ────────────────────────────────────────────────────── */
  if (qk === 'slider') {
    return (
      <SliderInput
        options={options}
        hasVoted={hasVoted}
        canVote={canVote}
        myVotes={myVotes}
        onVote={onVote}
      />
    )
  }

  /* ── Multi-choice ──────────────────────────────────────────────── */
  if (qk === 'multi_select') {
    return (
      <ul className="space-y-2" role="list">
        {options.map((o) => {
          const selected = myVotes.includes(o.id)
          return (
            <li key={o.id}>
              <button
                type="button"
                onClick={() => !selected && canVote && onVote(o.id)}
                disabled={selected || !canVote}
                aria-pressed={selected}
                className={concatClasses(
                  'w-full text-left rounded-lg border px-4 py-3.5 font-medium transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2',
                  selected
                    ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/30 text-teal-800 dark:text-teal-300'
                    : 'border-pulse-200 dark:border-[var(--color-border)] bg-white dark:bg-[var(--color-surface-elevated)] text-pulse-900 dark:text-[var(--text-primary)] hover:border-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/20 active:scale-[0.99]',
                  !canVote && 'opacity-50 cursor-not-allowed',
                )}
              >
                <span className="flex items-center gap-3">
                  <span
                    className={concatClasses(
                      'flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors',
                      selected ? 'border-teal-500 bg-teal-500' : 'border-pulse-300',
                    )}
                    aria-hidden="true"
                  >
                    {selected && <Check size={10} stroke="white" strokeWidth={3} aria-hidden="true" />}
                  </span>
                  {o.label}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    )
  }

  /* ── Upvote queue ──────────────────────────────────────────────── */
  if (qk === 'upvote') {
    return (
      <ul className="space-y-2" role="list">
        {options.map((o) => {
          const upvoted = myVotes.includes(o.id)
          const count = results.counts[o.id] ?? 0
          return (
            <li key={o.id} className="flex items-center gap-3 rounded-lg border border-pulse-200 dark:border-[var(--color-border)] bg-white dark:bg-[var(--color-surface)] px-4 py-3">
              <button
                type="button"
                onClick={() => !upvoted && canVote && onVote(o.id)}
                disabled={upvoted || !canVote}
                aria-label={t('upvote_aria', { label: o.label })}
                className={concatClasses(
                  'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium border transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500',
                  upvoted
                    ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300'
                    : 'border-pulse-200 dark:border-[var(--color-border)] text-pulse-600 dark:text-[var(--text-secondary)] hover:border-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/20',
                  !canVote && 'opacity-50 cursor-not-allowed',
                )}
              >
                <ThumbsUp
                  aria-hidden="true"
                  size={14}
                  fill={upvoted ? 'currentColor' : 'none'}
                  stroke="currentColor"
                  strokeWidth={2}
                />
                {count}
              </button>
              <span className="text-sm text-pulse-800 dark:text-[var(--text-primary)]">{o.label}</span>
            </li>
          )
        })}
      </ul>
    )
  }

  /* ── Default: poll / ranking / consent ──────────────────────────── */
  return (
    <ul className="space-y-2" role="list">
      {options.map((o) => {
        const voted = myVotes.includes(o.id)
        const otherVoted = hasVoted && !voted
        return (
          <li key={o.id}>
            <button
              type="button"
              onClick={() => onVote(o.id)}
              disabled={hasVoted || !canVote}
              aria-pressed={voted}
              className={concatClasses(
                'w-full text-left rounded-lg border px-4 py-3.5 font-medium transition-all duration-150',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2',
                voted
                  ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/30 text-teal-800 dark:text-teal-300'
                  : otherVoted
                  ? 'border-pulse-200 dark:border-[var(--color-border)] text-pulse-500 dark:text-[var(--text-muted)] cursor-default'
                  : 'border-pulse-200 dark:border-[var(--color-border)] bg-white dark:bg-[var(--color-surface-elevated)] text-pulse-900 dark:text-[var(--text-primary)] hover:border-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/20 active:scale-[0.99]',
                !canVote && 'opacity-50 cursor-not-allowed',
              )}
            >
              <span className="flex items-center gap-3">
                <span
                  className={concatClasses(
                    'flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors',
                    voted ? 'border-teal-500 bg-teal-500' : 'border-pulse-300',
                  )}
                  aria-hidden="true"
                >
                  {voted && <Check size={10} stroke="white" strokeWidth={3} aria-hidden="true" />}
                </span>
                {o.label}
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
