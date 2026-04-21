// Semantic component library — Design spec compliance (Phase 6+)
// All components pre-apply design tokens for consistency
// Usage: <Heading level="l">Page Title</Heading>

import { ReactNode } from 'react'

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
  return <span className={`text-caption font-medium text-pulse-600 ${className}`}>{children}</span>
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
        rounded-lg border border-pulse-200 bg-pulse-50 p-space-4
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
      hover:shadow-teal ${!disabled ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'}
    `,
    secondary: `
      border border-teal-500 text-teal-700 bg-white
      hover:bg-teal-50 ${!disabled ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'}
    `,
    ghost: `
      text-pulse-700 bg-transparent
      hover:bg-pulse-100 ${!disabled ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'}
    `,
    danger: `
      bg-signal-error text-white
      hover:shadow-[0_4px_20px_rgba(220,38,38,0.25)] ${!disabled ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'}
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
  placeholder,
  value,
  onChange,
  type = 'text',
  className = '',
}: {
  placeholder?: string
  value?: string
  onChange?: (v: string) => void
  type?: string
  className?: string
}) {
  return (
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      className={`
        border border-pulse-300 rounded-md px-space-3 py-space-2 text-body-s
        focus:border-teal-500 focus:ring-2 focus:ring-teal-100 focus:outline-none
        transition-all duration-150
        ${className}
      `}
    />
  )
}

// ─── Data Display ──────────────────────────────────────────────────────────

export function Badge({
  children,
  variant = 'primary',
  className = '',
}: {
  children: ReactNode
  variant?: 'primary' | 'ai' | 'success' | 'warning' | 'error'
  className?: string
}) {
  const variantStyles = {
    primary: 'bg-teal-100 text-teal-700 border border-teal-200',
    ai: 'bg-gradient-ai text-white border border-violet-400',
    success: 'bg-green-100 text-green-700 border border-green-200',
    warning: 'bg-amber-100 text-amber-700 border border-amber-200',
    error: 'bg-red-100 text-red-700 border border-red-200',
  }

  return (
    <span className={`inline-flex items-center gap-space-1 rounded-pill px-space-3 py-space-1 text-caption ${variantStyles[variant]} ${className}`}>
      {children}
    </span>
  )
}

export function MetricCard({
  label,
  value,
  alert = false,
  className = '',
}: {
  label: string
  value: string | number
  alert?: boolean
  className?: string
}) {
  return (
    <Card className={`${alert ? 'border-signal-error bg-red-50' : ''} ${className}`}>
      <Caption className={alert ? 'text-signal-error' : ''}>{label}</Caption>
      <div className={`text-2xl font-bold mt-space-2 ${alert ? 'text-signal-error' : 'text-pulse-900'}`}>
        {value}
      </div>
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
      <Heading level="m" className="text-pulse-700">
        {title}
      </Heading>
      {description && <Body className="text-pulse-600 mt-space-2">{description}</Body>}
      {action && <div className="mt-space-4">{action}</div>}
    </div>
  )
}

// ─── Loading States ────────────────────────────────────────────────────────

export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`rounded-lg border border-pulse-200 p-space-4 h-24 bg-pulse-100 animate-pulse ${className}`} />
  )
}

export function SkeletonLine({ className = '' }: { className?: string }) {
  return <div className={`h-4 bg-pulse-200 rounded-md animate-pulse ${className}`} />
}
