/**
 * TRUST3-BADGE-01 — trust signals for GDPR / scale / edge claims.
 */
type TrustBadgeProps = {
  variant?: 'gdpr' | 'edge' | 'scale'
  className?: string
}

const LABELS: Record<NonNullable<TrustBadgeProps['variant']>, string> = {
  gdpr: 'GDPR-ready controls',
  edge: 'Edge-hosted · EU-friendly',
  scale: 'Built for live audiences',
}

export function TrustBadge({ variant = 'gdpr', className = '' }: TrustBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-teal-200/80 bg-teal-50 px-3 py-1 text-xs font-medium text-teal-900 ${className}`}
      role="status"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-teal-500" aria-hidden />
      {LABELS[variant]}
    </span>
  )
}
