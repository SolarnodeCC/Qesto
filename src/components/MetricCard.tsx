import { TrendingDown, TrendingUp } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface MetricTrend {
  /** Absolute change magnitude (e.g. 4.2 for ±4.2%) */
  value: number
  direction: 'up' | 'down'
  /** When true, "up" is bad (e.g. latency going up). Inverts the colour. */
  inverted?: boolean
}

interface MetricCardProps {
  label: string
  value: string | number
  icon: LucideIcon
  /** Tailwind colour class for the icon well, defaults to teal */
  iconClassName?: string
  trend?: MetricTrend
  loading?: boolean
}

/**
 * Compact stat tile used in the Dashboard metric strip.
 * Design reference: `design_files/ui_kits/dashboard/index.html` — MetricCard component.
 */
export function MetricCard({ label, value, icon: Icon, iconClassName, trend, loading }: MetricCardProps) {
  const trendPositive = trend
    ? (trend.direction === 'up') !== (trend.inverted ?? false)
    : null

  return (
    <div className="rounded-xl border border-pulse-200 dark:border-[var(--color-border)] bg-white dark:bg-[var(--color-surface)] p-5 shadow-card">
      {/* Header: label + icon well */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-pulse-500 dark:text-[var(--text-muted)]">
          {label}
        </span>
        <span
          className={`flex items-center justify-center w-8 h-8 rounded-lg bg-pulse-50 dark:bg-[var(--color-surface-elevated)] ${iconClassName ?? 'text-teal-600 dark:text-teal-400'}`}
          aria-hidden="true"
        >
          <Icon size={16} />
        </span>
      </div>

      {/* Value */}
      {loading ? (
        <div className="h-8 w-20 rounded-lg skeleton-shimmer bg-pulse-200 dark:bg-pulse-800" aria-hidden="true" />
      ) : (
        <div className="text-[28px] font-bold leading-none text-pulse-900 dark:text-[var(--text-primary)] tracking-tight">
          {value}
        </div>
      )}

      {/* Trend chip */}
      {trend && !loading && (
        <div
          className={`mt-2 flex items-center gap-1 text-xs font-medium ${
            trendPositive ? 'text-teal-600 dark:text-teal-400' : 'text-red-500 dark:text-red-400'
          }`}
        >
          {trend.direction === 'up' ? (
            <TrendingUp size={12} aria-hidden="true" />
          ) : (
            <TrendingDown size={12} aria-hidden="true" />
          )}
          {trend.direction === 'up' ? '+' : '−'}{Math.abs(trend.value)}%
        </div>
      )}
    </div>
  )
}
