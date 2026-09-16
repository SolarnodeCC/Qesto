import { Check, Sparkles } from 'lucide-react'
import { useT } from '../../i18n'
import { useCountUp } from '../../hooks/useCountUp'

type OrderedOption = { id: string; label: string; count: number }

// One live-results row. The bar width is already CSS-transitioned; useCountUp
// tweens the visible percentage so the number moves with the bar as live votes
// arrive (Finding 5 #1). The percentage span is not aria-live, so tweening it
// does not spam assistive tech (the total below stays instant + aria-live).
function PostVoteRow({
  label,
  pct,
  isMyVote,
  yourVoteLabel,
}: {
  label: string
  pct: number
  isMyVote: boolean
  yourVoteLabel: string
}) {
  const shownPct = useCountUp(pct)
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className={isMyVote ? 'font-semibold text-teal-700' : 'text-pulse-700 dark:text-[var(--text-secondary)]'}>
          {label}
          {isMyVote && <span className="ml-1.5 text-xs text-teal-500">· {yourVoteLabel}</span>}
        </span>
        <span className="text-pulse-500 dark:text-[var(--text-muted)] tabular-nums">{shownPct}%</span>
      </div>
      <div className="h-2 bg-pulse-100 dark:bg-white/10 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-[width] duration-300 ${isMyVote ? 'bg-gradient-to-r from-teal-500 to-violet-500' : 'bg-pulse-300 dark:bg-white/20'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

interface PostVoteResultsProps {
  questionKind: string
  ordered: OrderedOption[]
  resultsTotal: number
  myVotes: string[]
}

export function PostVoteResults({ questionKind, ordered, resultsTotal, myVotes }: PostVoteResultsProps) {
  const t = useT('join')

  if (['word_cloud', 'open', 'slider'].includes(questionKind)) return null

  return (
    <div className="space-y-4 pt-2 border-t border-pulse-100 dark:border-[var(--color-border)]">
      <p role="status" aria-live="polite" className="flex items-center gap-2 text-sm font-medium text-teal-700 dark:text-teal-400">
        <Check size={16} aria-hidden="true" />
        {t('vote_recorded')}
      </p>
      <div className="flex items-center gap-2 text-[12px] text-violet-600 font-medium">
        <Sparkles size={12} aria-hidden="true" />
        <span>{t('workers_ai_recap_status')}</span>
      </div>

      {resultsTotal > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-pulse-500 dark:text-[var(--text-secondary)] flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" aria-hidden="true" />
            {t('live_results')}
          </p>
          {ordered.map((o) => {
            const pct = resultsTotal === 0 ? 0 : Math.round((o.count / resultsTotal) * 100)
            return (
              <PostVoteRow
                key={o.id}
                label={o.label}
                pct={pct}
                isMyVote={myVotes.includes(o.id)}
                yourVoteLabel={t('your_vote')}
              />
            )
          })}
          <p className="text-xs text-pulse-500 dark:text-[var(--text-muted)] text-right" aria-live="polite" aria-atomic="true">
            {t('total_votes', { count: resultsTotal })}
          </p>
        </div>
      )}
    </div>
  )
}
