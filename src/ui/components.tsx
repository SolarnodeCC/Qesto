// jankurai:allow HLT-001-DEAD-MARKER reason=tailwind-pseudo-variant-and-central-input-hint expires=2027-06-01
// Semantic component library — Design spec compliance (Phase 6+)
// All components pre-apply design tokens for consistency
// Usage: <Heading level="l">Page Title</Heading>

import { ReactNode } from 'react'
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
  return <span className={`text-caption font-medium text-pulse-600 dark:text-[#8A96B0] ${className}`}>{children}</span>
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
        rounded-lg border border-pulse-200 dark:border-[#1E2A45] bg-pulse-50 dark:bg-[#151C2E] p-space-4
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
  return <section className={`space-y-space-4 ${className}`}>{children}</section>
}

// ─── Buttons ──────────────────────────────────────────────────────────────

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  onClick,
  className = '',
  type = 'button',
}: {
  children: ReactNode
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  onClick?: () => void
  className?: string
  type?: 'button' | 'submit' | 'reset'
}) {
  const baseStyles = 'rounded-md font-medium transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2'

  const sizeStyles = {
    sm: 'px-space-3 py-space-2 text-body-s',
    md: 'px-space-4 py-space-2 text-body-m',
    lg: 'px-space-5 py-space-3 text-body-m',
  }

  const variantStyles = {
    primary: `
      bg-gradient-brand text-white
      hover:shadow-teal dark:hover:shadow-[0_4px_24px_rgba(45,212,191,0.35)] ${!disabled ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'}
    `,
    secondary: `
      border border-teal-500 dark:border-teal-400 text-teal-700 dark:text-teal-400 bg-white dark:bg-[#1C2540]
      hover:bg-teal-50 dark:hover:bg-teal-500/10 ${!disabled ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'}
    `,
    ghost: `
      text-pulse-700 dark:text-[#A8B3CC] bg-transparent
      hover:bg-pulse-100 dark:hover:bg-white/8 ${!disabled ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'}
    `,
    danger: `
      bg-signal-error dark:bg-red-500 text-white
      hover:shadow-error ${!disabled ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'}
    `,
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
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

export function MetricCard({
  label,
  value,
  alert = false,
  trend,
  className = '',
}: {
  label: string
  value: string | number
  alert?: boolean
  trend?: { value: number; direction: 'up' | 'down'; inverted?: boolean }
  className?: string
}) {
  const trendGood = trend
    ? (trend.direction === 'up') !== (trend.inverted ?? false)
    : null

  return (
    <Card className={`${alert ? 'border-signal-error bg-red-50' : ''} ${className}`}>
      <Caption className={alert ? 'text-signal-error' : ''}>{label}</Caption>
      <div className={`text-2xl font-bold mt-space-2 ${alert ? 'text-signal-error dark:text-red-400' : 'text-pulse-900 dark:text-[#F0F2F8]'}`}>
        {value}
      </div>
      {trend && (
        <div className={`mt-1 flex items-center gap-0.5 text-caption font-medium ${trendGood ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
          {trend.direction === 'up' ? '▲' : '▼'}
          {Math.abs(trend.value).toFixed(1)}%
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
    <div className="flex flex-col items-center justify-center py-space-12 text-center">
      <Heading level="m" className="text-pulse-700 dark:text-[#A8B3CC]">
        {title}
      </Heading>
      {description && <Body className="text-pulse-600 dark:text-[#8A96B0] mt-space-2">{description}</Body>}
      {action && <div className="mt-space-4">{action}</div>}
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
      <Body size="s" className="text-pulse-500 dark:text-[#8A96B0]">{label}</Body>
    </Card>
  )
}

// ─── Loading States ────────────────────────────────────────────────────────

export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`rounded-lg border border-pulse-200 dark:border-[#1E2A45] p-space-4 h-24 bg-pulse-100 dark:bg-[#151C2E] animate-pulse ${className}`} />
  )
}

export function SkeletonLine({ className = '' }: { className?: string }) {
  return <div className={`h-4 bg-pulse-200 dark:bg-[#1C2540] rounded-md animate-pulse ${className}`} />
}
