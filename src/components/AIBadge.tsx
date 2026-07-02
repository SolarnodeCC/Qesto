/**
 * AIBadge — marks AI-touched content with a labelled pill.
 *
 * Variants:
 *   assisted  — AI helped shape this (default)
 *   generated — content was fully AI-generated
 *   analyzed  — content was AI-analyzed/summarized
 */

import { Sparkles } from 'lucide-react'

type AIBadgeVariant = 'assisted' | 'generated' | 'analyzed'

interface AIBadgeProps {
  variant?: AIBadgeVariant
  /** Override the visible label (falls back to per-variant default) */
  label?: string
  /** Extra Tailwind classes to append to the container */
  className?: string
}

const VARIANT_DEFAULTS: Record<AIBadgeVariant, { label: string; tooltip: string }> = {
  assisted:  { label: 'AI assisted',  tooltip: 'Workers AI on Cloudflare\'s edge — no third-party model providers' },
  generated: { label: 'AI draft', tooltip: 'Drafted on Cloudflare\'s edge · no third-party model providers' },
  analyzed:  { label: 'AI recap', tooltip: 'Anchored to ranked evidence · edge inference · inside the same network as your session' },
}

export default function AIBadge({ variant = 'assisted', label, className = '' }: AIBadgeProps) {
  const defaults = VARIANT_DEFAULTS[variant]
  const visibleLabel = label ?? defaults.label

  return (
    <span
      className={[
        'inline-flex items-center gap-1 rounded-full px-3 py-1',
        'bg-violet-100 caption font-medium',
        'border border-violet-200',
        'dark:bg-violet-900/40 dark:text-violet-300 dark:border-violet-700',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      aria-label={visibleLabel}
      title={defaults.tooltip}
    >
      <Sparkles size={12} aria-hidden="true" />
      {visibleLabel}
    </span>
  )
}
