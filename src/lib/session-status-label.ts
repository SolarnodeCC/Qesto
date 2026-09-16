/**
 * Shared session-lifecycle status label helper for dashboard surfaces.
 * Keeps i18n keys in one place (DS Day 1–30 StatusBadge consolidation).
 */
import type { SessionStatus } from '../types/session'

export function sessionStatusLabel(status: SessionStatus, t: (key: string) => string): string {
  switch (status) {
    case 'live':
      return t('statusLive')
    case 'energizing':
      return t('statusEnergizing')
    case 'closed':
      return t('statusClosed')
    case 'archived':
      return t('statusArchived')
    case 'draft':
    default:
      return t('statusDraft')
  }
}
