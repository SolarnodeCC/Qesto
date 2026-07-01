/**
 * JoinCodeDisplay — canonical session/join code typography per the design system:
 * JetBrains Mono, uppercase, 0.1em tracking, tabular-nums, weight 600.
 */
export function JoinCodeDisplay({
  code,
  size = 'md',
  className = '',
}: {
  code: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const sizeClass = {
    sm: 'text-sm',
    md: 'text-2xl',
    lg: 'text-[2.6rem] leading-none',
  }[size]

  return (
    <span
      className={`font-mono font-semibold uppercase tracking-[0.1em] tabular-nums ${sizeClass} ${className}`}
    >
      {code}
    </span>
  )
}
