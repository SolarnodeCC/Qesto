import type { SessionStatus } from '@api/types'
import { Badge, type BadgeTone } from './components'

/**
 * StatusBadge — canonical session-lifecycle badge. Maps `SessionStatus` onto the
 * shared `Badge` tones per the documented design-system spec (LIVE=green + pulsing
 * dot, ENDED/closed=amber, transitional=info-blue, draft/archived=neutral). The
 * caller passes the already-localized `label` (owns its i18n namespace), mirroring
 * the layout shells' `connectionLabel` pattern.
 *
 * Replaces the per-page inline status-color maps flagged in
 * DESIGN_SYSTEM_AUDIT_2026-07-01.
 */
const STATUS_TONE: Record<SessionStatus, { tone: BadgeTone; dot?: boolean; pulse?: boolean }> = {
  live: { tone: 'success', dot: true, pulse: true },
  energizing: { tone: 'info', dot: true, pulse: true },
  closed: { tone: 'warning' },
  draft: { tone: 'neutral' },
  archived: { tone: 'neutral' },
}

export function StatusBadge({
  status,
  label,
  className = '',
}: {
  status: SessionStatus
  label: string
  className?: string
}) {
  const { tone, dot, pulse } = STATUS_TONE[status] ?? { tone: 'neutral' as BadgeTone }
  return (
    <Badge tone={tone} dot={!!dot} pulse={!!pulse} className={`uppercase tracking-wider ${className}`}>
      {label}
    </Badge>
  )
}
