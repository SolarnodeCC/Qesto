// jankurai:allow HLT-001-DEAD-MARKER reason=tailwind-pseudo-variant-and-central-input-hint expires=2027-06-01
// Semantic component library — Design spec compliance (Phase 6+ / DS Day 1–30)
// All components pre-apply design tokens for consistency
// Usage: <Heading level="l">Page Title</Heading>

import { ReactNode } from 'react'
import { TrendingDown, TrendingUp, type LucideIcon } from 'lucide-react'
import { inputHint } from './input-hint'
import { DEFAULT_TEXT_INPUT_CLASS } from './input-field-class'

// ─── Typography ──────────────────────────────────────────────────────────

export function Heading({
  level = 'm',
  children,
  className = '',
}: {
  level?: 's' | 'm' | 'l' | 'xl'
  children: ReactNode
  className?: string
}) {
  const styles = {
    s: 'text-heading-s font-semibold',      // 20px, 600wt
    m: 'text-heading-m font-semibold',      // 24px, 600wt
    l: 'text-heading-l font-semibold',      // 32px, 600wt
    xl: 'text-display-l font-bold',         // 48px, 700wt
  }
  const tag = { s: 'h3', m: 'h2', l: 'h1', xl: 'h1' }[level] as 'h1' | 'h2' | 'h3'
  const Component = tag

  return (
    <Component className={`${styles[level]} ${className}`} tabIndex={-1}>
      {children}
    </Component>
  )
}

export function Body({
  size = 'm',
  children,
  className = '',
}: {
  size?: 's' | 'm' | 'l'
  children: ReactNode
  className?: string
}) {
  const styles = {
    s: 'text-body-s',      // 14px, 400wt
    m: 'text-body-m',      // 16px, 400wt
    l: 'text-body-l',      // 18px, 400wt
  }
  return <p className={`${styles[size]} leading-relaxed ${className}`}>{children}</p>
}

export function Caption({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span className={`text-caption font-medium text-[var(--text-secondary)] ${className}`}>
      {children}
    </span>
  )
}

// ─── Layout ───────────────────────────────────────────────────────────────

export function Card({
  children,
  className = '',
  hoverable = false,
}: {
  children: ReactNode
  className?: string
  hoverable?: boolean
}) {
  return (
    <div
      className={`
        rounded-xl border border-pulse-200 border-[color:var(--color-border)] bg-[var(--color-surface)] p-4
        shadow-card ${hoverable ? 'hover:shadow-elevated transition-shadow' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  )
}

export function Section({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return <section className={`space-y-4 ${className}`}>{children}</section>
}

// ─── Buttons ──────────────────────────────────────────────────────────────

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'inverse'

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  onClick,
  className = '',
  type = 'button',
  'aria-label': ariaLabel,
  'aria-expanded': ariaExpanded,
  'aria-haspopup': ariaHaspopup,
  title,
}: {
  children: ReactNode
  variant?: ButtonVariant
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  onClick?: () => void
  className?: string
  type?: 'button' | 'submit' | 'reset'
  'aria-label'?: string
  'aria-expanded'?: boolean
  'aria-haspopup'?: boolean | 'menu' | 'listbox' | 'tree' | 'grid' | 'dialog'
  title?: string
}) {
  // ADR-0071: controls use rounded-lg (16px via --radius-lg).
  const baseStyles =
    'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2'

  // min-h keeps every Button a ≥44px touch target on phone viewports (WCAG
  // 2.5.5); sm relaxes to its compact desktop height from the sm breakpoint.
  const sizeStyles = {
    sm: 'px-3 py-2 text-body-s min-h-11 sm:min-h-9',
    md: 'px-4 py-2.5 text-sm min-h-11',
    lg: 'px-6 py-3 text-[15px] font-semibold min-h-11',
  }

  const variantStyles = {
    primary: `
      bg-gradient-brand text-white
      hover:shadow-teal ${!disabled ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'}
    `,
    secondary: `
      border border-pulse-300 dark:border-[var(--color-border-strong)] bg-white dark:bg-transparent
      text-pulse-700 dark:text-[var(--text-secondary)]
      hover:border-teal-400 dark:hover:border-teal-600 hover:text-teal-700 dark:hover:text-teal-400
      ${!disabled ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'}
    `,
    ghost: `
      text-[var(--text-secondary)] bg-transparent
      hover:bg-pulse-100 dark:hover:bg-white/8 ${!disabled ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'}
    `,
    danger: `
      bg-signal-error text-white
      hover:shadow-error ${!disabled ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'}
    `,
    // Dashboard / high-contrast solid CTA (light: near-black, dark: near-white).
    inverse: `
      bg-pulse-900 dark:bg-[var(--text-primary)] text-white dark:text-pulse-900 shadow-card
      hover:opacity-90 ${!disabled ? 'cursor-pointer' : 'opacity-60 cursor-not-allowed'}
    `,
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-expanded={ariaExpanded}
      aria-haspopup={ariaHaspopup}
      title={title}
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
    >
      {children}
    </button>
  )
}

// ─── Inputs ────────────────────────────────────────────────────────────────

export function TextInput({
  hintText,
  value,
  onChange,
  type = 'text',
  className = '',
}: {
  hintText?: string
  value?: string
  onChange?: (v: string) => void
  type?: string
  className?: string
}) {
  return (
    <input
      type={type}
      {...(hintText ? inputHint(hintText) : {})}
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      className={`${DEFAULT_TEXT_INPUT_CLASS} ${className}`}
    />
  )
}

// ─── Data Display ──────────────────────────────────────────────────────────

/**
 * Badge — the shared pill primitive. `tone` selects a semantic color; feature
 * families map their own states (session status, moderation, roles, …) onto
 * these tones rather than hand-rolling per-family color maps. `dot` renders a
 * leading status dot; `pulse` animates it (the LIVE indicator).
 *
 * Canonical status→tone mappings live in StatusBadge (session lifecycle) and at
 * each family's call site. See DESIGN_SYSTEM_AUDIT_2026-07-01.
 */
export type BadgeTone = 'neutral' | 'brand' | 'success' | 'info' | 'warning' | 'danger' | 'ai'

const BADGE_TONE_STYLES: Record<BadgeTone, string> = {
  neutral: 'bg-pulse-100 dark:bg-pulse-800 text-pulse-600 dark:text-pulse-300 border border-pulse-200 dark:border-pulse-700',
  brand: 'bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800',
  success: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800',
  info: 'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800',
  warning: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800',
  danger: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800',
  ai: 'bg-gradient-ai text-white border border-violet-400 dark:border-violet-500',
}

const BADGE_DOT_STYLES: Record<BadgeTone, string> = {
  neutral: 'bg-pulse-400',
  brand: 'bg-teal-500',
  success: 'bg-signal-success',
  info: 'bg-sky-500',
  warning: 'bg-amber-500',
  danger: 'bg-red-500',
  ai: 'bg-white',
}

export function Badge({
  children,
  tone = 'neutral',
  dot = false,
  pulse = false,
  className = '',
}: {
  children: ReactNode
  tone?: BadgeTone
  /** Render a leading status dot in the tone color. */
  dot?: boolean
  /** Animate the dot (use with `dot` for the LIVE indicator). */
  pulse?: boolean
  className?: string
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${BADGE_TONE_STYLES[tone]} ${className}`}
    >
      {dot && (
        <span
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${BADGE_DOT_STYLES[tone]} ${pulse ? 'animate-pulse' : ''}`}
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  )
}

export type MetricTrend = {
  /** Absolute change magnitude (e.g. 4.2 for ±4.2%) */
  value: number
  direction: 'up' | 'down'
  /** When true, "up" is bad (e.g. latency going up). Inverts the colour. */
  inverted?: boolean
}

/**
 * Unified MetricCard (DS Day 1–30). Merges admin (label/value/alert) and
 * dashboard (icon well + loading skeleton) APIs. Prefer this over
 * `components/MetricCard.tsx` (thin re-export).
 */
export function MetricCard({
  label,
  value,
  alert = false,
  trend,
  icon: Icon,
  iconClassName,
  loading = false,
  className = '',
}: {
  label: string
  value: string | number
  alert?: boolean
  trend?: MetricTrend
  icon?: LucideIcon
  iconClassName?: string
  loading?: boolean
  className?: string
}) {
  const trendGood = trend
    ? (trend.direction === 'up') !== (trend.inverted ?? false)
    : null

  return (
    <Card className={`${alert ? 'border-signal-error bg-red-50 dark:bg-red-950/30' : ''} ${Icon ? 'p-6' : ''} ${className}`}>
      {Icon ? (
        <div className="flex items-center justify-between mb-3">
          <Caption className={alert ? 'text-signal-error uppercase tracking-widest text-[11px] font-semibold' : 'uppercase tracking-widest text-[11px] font-semibold text-[var(--text-muted)]'}>
            {label}
          </Caption>
          <span
            className={`flex items-center justify-center w-12 h-12 rounded-lg bg-pulse-50 dark:bg-[var(--color-surface-elevated)] ${iconClassName ?? 'text-teal-600 dark:text-teal-400'}`}
            aria-hidden="true"
          >
            <Icon size={16} />
          </span>
        </div>
      ) : (
        <Caption className={alert ? 'text-signal-error' : ''}>{label}</Caption>
      )}

      {loading ? (
        <div className="h-12 w-20 rounded-lg skeleton-shimmer bg-pulse-200 dark:bg-pulse-800 mt-2" aria-hidden="true" />
      ) : (
        <div
          className={`font-bold mt-2 text-[var(--text-primary)] ${
            alert ? 'text-signal-error dark:text-red-400' : ''
          } ${Icon ? 'text-[28px] leading-none tracking-tight' : 'text-2xl'}`}
        >
          {value}
        </div>
      )}

      {trend && !loading && (
        <div
          className={`mt-2 flex items-center gap-1 text-xs font-medium ${
            trendGood ? 'text-teal-600 dark:text-teal-400' : 'text-red-500 dark:text-red-400'
          }`}
        >
          {Icon ? (
            trend.direction === 'up' ? (
              <TrendingUp size={12} aria-hidden="true" />
            ) : (
              <TrendingDown size={12} aria-hidden="true" />
            )
          ) : (
            <span aria-hidden="true">{trend.direction === 'up' ? '▲' : '▼'}</span>
          )}
          {Icon ? (
            <>
              {trend.direction === 'up' ? '+' : '−'}
              {Math.abs(trend.value)}%
            </>
          ) : (
            <>{Math.abs(trend.value).toFixed(1)}%</>
          )}
        </div>
      )}
    </Card>
  )
}

// ─── Empty States ──────────────────────────────────────────────────────────

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <Heading level="m" className="text-[var(--text-secondary)]">
        {title}
      </Heading>
      {description && <Body className="text-[var(--text-muted)] mt-2">{description}</Body>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

// Value-first centered stat card — matches Analytics KpiCard pattern
export function StatCard({
  label,
  value,
  colour = 'text-teal-600',
  className = '',
}: {
  label: string
  value: string | number
  colour?: string
  className?: string
}) {
  return (
    <Card className={`text-center space-y-1 ${className}`}>
      <p className={`text-heading-m font-bold ${colour}`}>{value}</p>
      <Body size="s" className="text-[var(--text-muted)]">{label}</Body>
    </Card>
  )
}

// ─── Loading States ────────────────────────────────────────────────────────

export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div
      className={`rounded-xl border border-pulse-200 border-[color:var(--color-border)] p-4 h-24 bg-pulse-100 dark:bg-[var(--color-surface)] animate-pulse ${className}`}
    />
  )
}

export function SkeletonLine({ className = '' }: { className?: string }) {
  return <div className={`h-4 bg-pulse-200 dark:bg-[var(--color-surface-elevated)] rounded-md animate-pulse ${className}`} />
}
