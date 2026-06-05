import type { IdeateIdea } from '../hooks/useIdeateSession'

type TFn = (key: string, vars?: Record<string, string | number>) => string

type Props = {
  idea: IdeateIdea
  variant: 'present' | 'join'
  upvoted?: boolean
  canVote?: boolean
  showCounts?: boolean
  onUpvote?: (id: string) => void
  t: TFn
}

export function IdeateIdeaCard({ idea, variant, upvoted, canVote, showCounts = false, onUpvote, t }: Props) {
  const showVote = variant === 'join'

  return (
    <article className="rounded-lg border border-pulse-200 bg-white px-3 py-2.5 dark:border-pulse-700 dark:bg-pulse-900/30">
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
    </article>
  )
}
