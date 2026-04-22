/**
 * InsightThemeCard — displays a single AI-identified insight theme.
 *
 * Used in the Dashboard Insights tab. Each card shows:
 *  - theme title
 *  - brief description
 *  - count of sessions the theme applies to
 *
 * Includes a hover state and a visual affordance for future drill-down linking.
 */

interface InsightThemeCardProps {
  title: string
  description: string
  sessionCount: number
  /** Optional click handler for future drill-down navigation */
  onClick?: () => void
}

export default function InsightThemeCard({
  title,
  description,
  sessionCount,
  onClick,
}: InsightThemeCardProps) {
  const Tag = onClick ? 'button' : 'div'

  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={[
        'w-full text-left rounded-xl border border-pulse-200 p-5 space-y-3',
        'transition-all duration-150',
        onClick
          ? 'cursor-pointer hover:border-violet-400 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2'
          : '',
      ]
        .filter(Boolean)
        .join(' ')}
      aria-label={onClick ? `View details for theme: ${title}` : undefined}
    >
      {/* Title row */}
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold text-pulse-900 leading-snug">{title}</h3>
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
            className="text-pulse-400 flex-shrink-0 mt-0.5"
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
        )}
      </div>

      {/* Description */}
      <p className="text-sm text-pulse-600 leading-relaxed">{description}</p>

      {/* Session count chip */}
      <div className="flex items-center gap-1.5">
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
          className="text-pulse-400"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M3 9h18M9 21V9" />
        </svg>
        <span className="text-xs text-pulse-500">
          {sessionCount} {sessionCount === 1 ? 'session' : 'sessions'}
        </span>
      </div>
    </Tag>
  )
}
