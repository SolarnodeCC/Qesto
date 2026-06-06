import { Sparkles } from 'lucide-react'
import { useT } from '../../i18n'

type OrderedOption = { id: string; label: string; count: number }

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
    <div className="space-y-4 pt-2 border-t border-pulse-100 dark:border-[#1E2A45]">
      <p role="status" aria-live="polite" className="flex items-center gap-2 text-sm font-medium text-teal-700">
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
        {t('vote_recorded')}
      </p>
      <div className="flex items-center gap-2 text-[12px] text-violet-600 font-medium">
        <Sparkles size={12} aria-hidden="true" />
        <span>{t('workers_ai_recap_status')}</span>
      </div>

      {resultsTotal > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-pulse-500 dark:text-[#A8B3CC] flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" aria-hidden="true" />
            {t('live_results')}
          </p>
          {ordered.map((o) => {
            const pct = resultsTotal === 0 ? 0 : Math.round((o.count / resultsTotal) * 100)
            const isMyVote = myVotes.includes(o.id)
            return (
              <div key={o.id} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className={isMyVote ? 'font-semibold text-teal-700' : 'text-pulse-700 dark:text-[#A8B3CC]'}>
                    {o.label}
                    {isMyVote && <span className="ml-1.5 text-xs text-teal-500">· {t('your_vote')}</span>}
                  </span>
                  <span className="text-pulse-500 dark:text-[#6B7A99] tabular-nums">{pct}%</span>
                </div>
                <div className="h-2 bg-pulse-100 dark:bg-white/10 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-[width] duration-300 ${isMyVote ? 'bg-gradient-to-r from-teal-500 to-violet-500' : 'bg-pulse-300 dark:bg-white/20'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )
          })}
          <p className="text-xs text-pulse-400 dark:text-[#6B7A99] text-right" aria-live="polite" aria-atomic="true">
            {t('total_votes', { count: resultsTotal })}
          </p>
        </div>
      )}
    </div>
  )
}
