/**
 * Marketplace payout calculation helpers (CONTRACT-MARKETPLACE-PAYOUT-01).
 * Pure functions — deterministic revenue split and idempotency keys.
 */

/** Default platform take: 30% (7000 bps to partner). */
export const DEFAULT_PARTNER_SHARE_BPS = 7000

export type PayoutSplit = {
  grossCents: number
  feeCents: number
  netCents: number
  partnerShareBps: number
}

/** Deterministic partner/platform split from gross sale amount. */
export function splitMarketplacePayout(grossCents: number, partnerShareBps = DEFAULT_PARTNER_SHARE_BPS): PayoutSplit {
  const feeCents = Math.floor((grossCents * (10_000 - partnerShareBps)) / 10_000)
  const netCents = grossCents - feeCents
  return { grossCents, feeCents, netCents, partnerShareBps }
}

export type PayoutRecord = {
  payoutId: string
  teamId: string
  amountCents: number
  currency: string
  stripeAccountId: string
  status: 'pending' | 'initiated' | 'paid' | 'failed'
  createdAt: number
}

/** Stable idempotency key for duplicate payout requests (same period + amount). */
export function payoutIdempotencyKey(teamId: string, amountCents: number, period: string): string {
  return `payout:${teamId}:${period}:${amountCents}`
}

/**
 * Reconciliation guard: sum of partner nets must not exceed gross revenue pool.
 * Returns true when ledger is balanced (no overpayment).
 */
export function reconcilePayoutLedger(
  grossRevenueCents: number,
  payoutNetCents: number[],
): { balanced: boolean; totalNet: number; remainder: number } {
  const totalNet = payoutNetCents.reduce((s, n) => s + n, 0)
  return {
    balanced: totalNet <= grossRevenueCents,
    totalNet,
    remainder: grossRevenueCents - totalNet,
  }
}
