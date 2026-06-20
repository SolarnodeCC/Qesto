import type { InsightConfidence } from '../hooks/useInsights'
import TrendSpark from './TrendSpark'

const CONFIDENCE_STYLES: Record<InsightConfidence, { chip: string; label: string }> = {
  high:   { chip: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',   label: 'High' },
  medium: { chip: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300', label: 'Med' },
  low:    { chip: 'bg-pulse-100 text-pulse-600 dark:bg-pulse-700 dark:text-pulse-400',    label: 'Low' },
}

interface InsightThemeCardProps {
  title: string
  description: string
  sessionCount: number
  /** AI-derived confidence level for this theme */
  confidence?: InsightConfidence
  /** 30-day weekly trend buckets (oldest → newest) */
  trend30d?: number[]
  /** Optional click handler for future drill-down navigation */
  onClick?: () => void
}

export default function InsightThemeCard({
  title,
  description,
  sessionCount,
  confidence,
  trend30d,
  onClick,
}: InsightThemeCardProps) {
  const Tag = onClick ? 'button' : 'div'

  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={[
        'w-full text-left rounded-lg border border-pulse-200 bg-pulse-50 p-space-5 space-y-space-3',
        'shadow-card transition-all duration-150',
        'dark:bg-pulse-800 dark:border-pulse-700',
        onClick
          ? 'cursor-pointer hover:border-violet-400 hover:shadow-elevated focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 dark:hover:border-violet-500'
          : '',
      ]
        .filter(Boolean)
        .join(' ')}
      aria-label={onClick ? `View details for theme: ${title}` : undefined}
    >
      {/* Title row */}
      <div className="flex items-start justify-between gap-space-3">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-body-s font-semibold text-pulse-900 dark:text-pulse-100 leading-snug">{title}</h3>
          {confidence && (
            <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${CONFIDENCE_STYLES[confidence].chip}`}>
              {CONFIDENCE_STYLES[confidence].label}
            </span>
          )}
        </div>
        {/* Drill-down chevron — only when clickable */}
        {onClick && (
          <svg
            aria-hidden="true"
            focusable="false"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-pulse-500 dark:text-pulse-500 flex-shrink-0 mt-0.5"
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
        )}
      </div>

      {/* Description */}
      <p className="text-body-s text-pulse-600 dark:text-pulse-400 leading-relaxed">{description}</p>

      {/* Session count + trend sparkline */}
      <div className="flex items-center justify-between gap-space-2">
        <div className="flex items-center gap-space-2">
          <svg
            aria-hidden="true"
            focusable="false"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-pulse-500 dark:text-pulse-500"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M3 9h18M9 21V9" />
          </svg>
          <span className="text-caption text-pulse-500 dark:text-pulse-400">
            {sessionCount} {sessionCount === 1 ? 'session' : 'sessions'}
          </span>
        </div>
        {trend30d && trend30d.some((v) => v > 0) && (
          <TrendSpark data={trend30d} width={56} height={20} />
        )}
      </div>
    </Tag>
  )
}
