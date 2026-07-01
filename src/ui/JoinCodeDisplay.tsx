/**
 * JoinCodeDisplay — canonical session/join code typography per the design system:
 * JetBrains Mono, uppercase, 0.1em tracking, tabular-nums, weight 600.
 */
export function JoinCodeDisplay({
  code,
  size = 'md',
  className = '',
  'aria-label': ariaLabel,
}: {
  code: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  'aria-label'?: string
}) {
  const sizeClass = {
    sm: 'text-sm',
    md: 'text-2xl',
    lg: 'text-[2.6rem] leading-none',
    xl: 'text-[52px] leading-none',
  }[size]

  return (
    <span
      aria-label={ariaLabel}
      className={`font-mono font-semibold uppercase tracking-[0.1em] tabular-nums ${sizeClass} ${className}`}
    >
      {code}
    </span>
  )
}
