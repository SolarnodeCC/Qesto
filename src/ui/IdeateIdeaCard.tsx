import type { IdeateIdea } from '../hooks/useIdeateSession'

type TFn = (key: string, vars?: Record<string, string | number>) => string

type Props = {
  idea: IdeateIdea
  variant: 'present' | 'join'
  upvoted?: boolean
  canVote?: boolean
  showCounts?: boolean
  onUpvote?: (id: string) => void
  onDismiss?: (id: string) => void
  onMergePick?: (id: string) => void
  onMergeInto?: (targetId: string) => void
  mergeSourceId?: string | null
  t: TFn
}

export function IdeateIdeaCard({
  idea,
  variant,
  upvoted,
  canVote,
  showCounts = false,
  onUpvote,
  onDismiss,
  onMergePick,
  onMergeInto,
  mergeSourceId,
  t,
}: Props) {
  const showVote = variant === 'join'
  const showModeration = variant === 'present' && (onDismiss || onMergePick || onMergeInto)
  const isMergeSource = mergeSourceId === idea.id
  const canMergeHere = mergeSourceId && mergeSourceId !== idea.id

  return (
    <article
      className={`rounded-lg border px-3 py-2.5 ${
        isMergeSource
          ? 'border-amber-400 bg-amber-50 dark:border-amber-600 dark:bg-amber-900/20'
          : 'border-pulse-200 bg-white dark:border-pulse-700 dark:bg-pulse-900/30'
      }`}
    >
      <p className="text-sm text-pulse-800 dark:text-pulse-100">{idea.body}</p>
      {showVote && (
        <button
          type="button"
          disabled={!canVote || upvoted}
          onClick={() => onUpvote?.(idea.id)}
          aria-label={t('vote.aria', { body: idea.body })}
          className={`mt-2 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium ${
            upvoted
              ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300'
              : 'bg-pulse-100 text-pulse-700 hover:bg-violet-100 hover:text-violet-700 dark:bg-pulse-800 dark:text-pulse-200'
          } disabled:opacity-50`}
        >
          <span aria-hidden="true">●</span>
          {showCounts ? idea.upvotes : upvoted ? t('vote.voted') : t('vote.dot')}
        </button>
      )}
      {(variant === 'present' || showCounts) && idea.upvotes > 0 && (
        <p className="mt-1 text-xs text-violet-600 dark:text-violet-400">
          {t('vote.count', { count: idea.upvotes })}
        </p>
      )}
      {showModeration && (
        <div className="mt-2 flex flex-wrap gap-2">
          {onDismiss && (
            <button
              type="button"
              onClick={() => onDismiss(idea.id)}
              className="rounded px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
            >
              {t('moderate.dismiss')}
            </button>
          )}
          {onMergePick && !mergeSourceId && (
            <button
              type="button"
              onClick={() => onMergePick(idea.id)}
              className="rounded px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-900/20"
            >
              {t('moderate.merge')}
            </button>
          )}
          {canMergeHere && onMergeInto && (
            <button
              type="button"
              onClick={() => onMergeInto(idea.id)}
              className="rounded bg-amber-600 px-2 py-1 text-xs font-medium text-white hover:bg-amber-700"
            >
              {t('moderate.mergeHere')}
            </button>
          )}
        </div>
      )}
    </article>
  )
}
