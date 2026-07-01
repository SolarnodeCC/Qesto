import { ArrowBigUp, Check, EyeOff, RotateCcw, MessageSquare, Star } from 'lucide-react'
import type { TownhallBoardItem } from '../hooks/useTownhallSession'
import { Badge, type BadgeTone } from './components'

type Variant = 'audience' | 'console'

type Props = {
  item: TownhallBoardItem
  variant: Variant
  /** Audience: whether this client has already upvoted. */
  upvoted?: boolean
  onUpvote?: (itemId: string) => void
  onModerate?: (itemId: string, action: string) => void
  t: (key: string, vars?: Record<string, string | number>) => string
}

/** Question-moderation state → shared Badge tone (DESIGN_SYSTEM_AUDIT_2026-07-01). */
const MODERATION_TONE: Record<string, BadgeTone> = {
  pending: 'warning',
  approved: 'success',
  answered: 'neutral',
  dismissed: 'danger',
}

/** Shared Q&A card for the participant board (audience) and the host console. */
export function TownhallQuestionCard({ item, variant, upvoted, onUpvote, onModerate, t }: Props) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        item.isSpotlit ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20 ring-2 ring-teal-200 dark:ring-teal-800' : 'border-pulse-200 dark:border-[#1E2A45] bg-white dark:bg-[#151C2E]'
      }`}
    >
      {item.isSpotlit && (
        <p className="mb-2 inline-flex items-center gap-1 text-xs font-semibold text-teal-700 dark:text-teal-400">
          <Star className="h-3.5 w-3.5" aria-hidden="true" /> {t('queue.spotlight')}
        </p>
      )}
      <div className="flex items-start gap-3">
        {variant === 'audience' && (
          <button
            type="button"
            onClick={() => !upvoted && onUpvote?.(item.id)}
            disabled={upvoted}
            aria-pressed={upvoted}
            aria-label={t('upvote.aria', { body: item.body })}
            className={`flex shrink-0 flex-col items-center rounded-lg border px-2.5 py-1.5 text-sm font-semibold transition ${
              upvoted
                ? 'border-teal-500 bg-teal-500 text-white'
                : 'border-pulse-200 dark:border-[#1E2A45] text-pulse-700 dark:text-[#A8B3CC] hover:border-teal-400 hover:text-teal-700 dark:hover:border-teal-600 dark:hover:text-teal-400'
            }`}
          >
            <ArrowBigUp className="h-4 w-4" aria-hidden="true" />
            {item.upvotes}
          </button>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-pulse-900 dark:text-[#F0F2F8]">{item.body}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-pulse-500 dark:text-[#8A96B0]">
            <span>{item.displayName ?? t('submit.button')}</span>
            {variant === 'console' && (
              <Badge tone={MODERATION_TONE[item.status] ?? 'neutral'}>
                {t(`console.${item.status === 'pending' ? 'pending' : item.status}`)}
              </Badge>
            )}
            {variant === 'console' && (
              <span className="inline-flex items-center gap-1">
                <ArrowBigUp className="h-3.5 w-3.5" aria-hidden="true" />
                {item.upvotes}
              </span>
            )}
            {item.groupedCount > 0 && <span>+{item.groupedCount}</span>}
          </div>
        </div>
      </div>

      {variant === 'console' && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {item.status === 'pending' && (
            <ConsoleBtn icon={Check} label={t('action.approve')} onClick={() => onModerate?.(item.id, 'approve')} primary />
          )}
          {item.status === 'dismissed' ? (
            <ConsoleBtn icon={RotateCcw} label={t('action.restore')} onClick={() => onModerate?.(item.id, 'restore')} />
          ) : (
            <ConsoleBtn icon={EyeOff} label={t('action.dismiss')} onClick={() => onModerate?.(item.id, 'dismiss')} />
          )}
          {item.status === 'approved' && (
            <>
              <ConsoleBtn
                icon={Star}
                label={item.isSpotlit ? t('action.clearSpotlight') : t('action.spotlight')}
                onClick={() => onModerate?.(item.id, item.isSpotlit ? 'clear_spotlight' : 'spotlight')}
              />
              <ConsoleBtn icon={MessageSquare} label={t('action.answer')} onClick={() => onModerate?.(item.id, 'answer')} />
            </>
          )}
        </div>
      )}
    </div>
  )
}

function ConsoleBtn({
  icon: Icon,
  label,
  onClick,
  primary,
}: {
  icon: typeof Check
  label: string
  onClick: () => void
  primary?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium ${
        primary ? 'bg-teal-600 text-white hover:bg-teal-700' : 'border border-pulse-200 dark:border-[#2A3858] text-pulse-700 dark:text-[#A8B3CC] hover:bg-pulse-50 dark:hover:bg-white/5'
      }`}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {label}
    </button>
  )
}
