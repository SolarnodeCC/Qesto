// ADR-0074 — client-side helpers for the temporary free-access window.
//
// The server is the authority: `plan` on /api/auth/me is already the effective
// tier, and every gate is enforced server-side. These helpers only shape what
// the UI *says* — the countdown, and whether upgrade CTAs make sense right now.

import type { FreeAccessStatus } from '../hooks/useAuth'

/** Whole days until the window closes; 0 on the last day, never negative. */
export function freeAccessDaysLeft(until: string, now = Date.now()): number {
  const end = Date.parse(until)
  if (!Number.isFinite(end)) return 0
  return Math.max(0, Math.ceil((end - now) / 86_400_000))
}

/**
 * Whether to suppress upgrade calls-to-action. Asking someone to pay for what
 * they already have for free reads as a bug, so the CTAs stand down while the
 * window is open and come back on their own when it closes.
 */
export function suppressUpgradeCta(promo: FreeAccessStatus | null | undefined): boolean {
  return promo?.active === true
}
