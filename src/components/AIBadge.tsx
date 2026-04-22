/**
 * AIBadge — a small pill/chip that marks AI-generated content.
 *
 * Usage:
 *   <AIBadge />               — default "AI suggested" label
 *   <AIBadge label="AI" />    — custom label
 */

interface AIBadgeProps {
  /** Override the visible label (default: "AI suggested") */
  label?: string
  /** Extra Tailwind classes to append to the container */
  className?: string
}

export default function AIBadge({ label = 'AI suggested', className = '' }: AIBadgeProps) {
  return (
    <span
      className={[
        'inline-flex items-center gap-space-1 rounded-pill px-space-3 py-space-1',
        'bg-violet-100 text-violet-700 text-caption font-medium',
        'border border-violet-200',
        'dark:bg-violet-900/40 dark:text-violet-300 dark:border-violet-700',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      aria-label={label}
    >
      {/* Sparkle icon — decorative */}
      <svg
        aria-hidden="true"
        focusable="false"
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="currentColor"
      >
        <path d="M12 2l2.09 6.26L20 10l-5.91 1.74L12 18l-2.09-5.26L4 11l5.91-1.74L12 2z" />
      </svg>
      {label}
    </span>
  )
}
