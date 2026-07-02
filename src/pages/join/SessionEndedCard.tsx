import { CheckCircle2, Sparkles } from 'lucide-react'
import { useT } from '../../i18n'

type OrderedOption = { id: string; label: string; count: number }

interface SessionEndedCardProps {
  ordered: OrderedOption[]
  maxCount: number
  resultsTotal: number
}

export function SessionEndedCard({ ordered, maxCount, resultsTotal }: SessionEndedCardProps) {
  const t = useT('join')

  return (
    <div className="rounded-xl border border-pulse-200 dark:border-[var(--color-border)] p-6 text-center space-y-2">
      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-teal-500 to-violet-500 flex items-center justify-center mx-auto shadow-teal" aria-hidden="true">
        <CheckCircle2 size={28} className="text-white" />
      </div>
      <p className="font-semibold text-pulse-900 dark:text-[var(--text-primary)]">{t('session_ended_title')}</p>
      <p className="text-sm text-pulse-500 dark:text-[var(--text-secondary)]">{t('session_ended_body')}</p>
      {resultsTotal > 0 && (
        <div className="mt-4 space-y-3 text-left">
          <p className="text-xs font-semibold uppercase tracking-wider text-pulse-500 dark:text-[var(--text-secondary)]">{t('final_results')}</p>
          {ordered.map((o) => {
            const pct = maxCount === 0 ? 0 : Math.round((o.count / resultsTotal) * 100)
            const isWinner = o.count === maxCount && maxCount > 0
            return (
              <div key={o.id} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className={isWinner ? 'font-semibold text-teal-700' : 'text-pulse-700 dark:text-[var(--text-secondary)]'}>
                    {o.label}
                  </span>
                  <span className="text-pulse-500 dark:text-[var(--text-muted)]">{o.count} · {pct}%</span>
                </div>
                <div className="h-2 bg-pulse-100 dark:bg-white/10 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-[width] duration-500 ${isWinner ? 'bg-gradient-to-r from-teal-500 to-violet-500' : 'bg-pulse-300 dark:bg-white/20'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )
          })}
          <p className="text-xs text-pulse-500 dark:text-[var(--text-muted)] text-right">{t('total_votes', { count: resultsTotal })}</p>
        </div>
      )}
      <div className="mt-4 rounded-[14px] bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 p-4 flex gap-3 items-start text-left">
        <Sparkles size={20} className="text-violet-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
        <div>
          <p className="text-[12px] font-bold tracking-[0.06em] uppercase text-violet-700 dark:text-violet-400 mb-1">{t('ai_recap_pending')}</p>
          <p className="text-[13px] text-pulse-600 dark:text-[var(--text-secondary)] leading-[1.45]">{t('ai_recap_body')}</p>
        </div>
      </div>
    </div>
  )
}
