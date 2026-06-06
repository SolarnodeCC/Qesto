import type { RetroItem } from '../hooks/useRetroSession'

type TFn = (key: string, vars?: Record<string, string | number>) => string

type Props = {
  item: RetroItem
  variant: 'present' | 'join' | 'display'
  upvoted?: boolean
  canVote?: boolean
  onUpvote?: (id: string) => void
  t: TFn
}

export function RetroItemCard({ item, variant, upvoted, canVote, onUpvote, t }: Props) {
  const isDisplay = variant === 'display'
  const showVote = item.column === 'actions' && variant === 'join'

  return (
    <article
      className={`rounded-lg border px-3 py-2.5 ${
        isDisplay
          ? 'border-white/10 bg-white/5 text-white'
          : 'border-pulse-200 bg-white dark:border-pulse-700 dark:bg-pulse-900/30'
      } ${item.carried ? 'border-l-4 border-l-violet-400' : ''}`}
    >
      <p className={`text-sm ${isDisplay ? 'text-lg' : 'text-pulse-800 dark:text-pulse-100'}`}>{item.body}</p>
      {item.carried && (
        <p className={`mt-1 text-xs ${isDisplay ? 'text-violet-300' : 'text-violet-600 dark:text-violet-400'}`}>
          {t('item.carried')}
        </p>
      )}
      {showVote && (
        <button
          type="button"
          disabled={!canVote || upvoted}
          onClick={() => onUpvote?.(item.id)}
          aria-label={t('vote.aria', { body: item.body })}
          className={`mt-2 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium ${
            upvoted
              ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300'
              : 'bg-pulse-100 text-pulse-700 hover:bg-violet-100 hover:text-violet-700 dark:bg-pulse-800 dark:text-pulse-200'
          } disabled:opacity-50`}
        >
          <span aria-hidden="true">●</span>
          {item.upvotes}
        </button>
      )}
      {item.column === 'actions' && (variant === 'present' || variant === 'display') && item.upvotes > 0 && (
        <p
          className={`mt-1 text-xs ${
            isDisplay ? 'text-violet-300' : 'text-violet-600 dark:text-violet-400'
          }`}
        >
          {t('vote.count', { count: item.upvotes })}
        </p>
      )}
    </article>
  )
}
