/**
 * CONTRACT-MARKETPLACE-PAYOUT-01 — payout schema + reconciliation contract (Sprint 83).
 */
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PARTNER_SHARE_BPS,
  payoutIdempotencyKey,
  reconcilePayoutLedger,
  splitMarketplacePayout,
} from '../../functions/api/lib/marketplace-payout'

describe('marketplace payout contract', () => {
  it('split is deterministic for a fixed gross and share bps', () => {
    const a = splitMarketplacePayout(10_000, DEFAULT_PARTNER_SHARE_BPS)
    const b = splitMarketplacePayout(10_000, DEFAULT_PARTNER_SHARE_BPS)
    expect(a).toEqual(b)
    expect(a.feeCents + a.netCents).toBe(10_000)
    expect(a.netCents).toBe(7000)
    expect(a.feeCents).toBe(3000)
  })

  it('payout record shape is stable', () => {
    const record = {
      payoutId: 'po_1',
      teamId: 'team-1',
      amountCents: 5000,
      currency: 'eur',
      stripeAccountId: 'acct_123',
      status: 'initiated' as const,
      createdAt: Date.now(),
    }
    expect(record).toMatchObject({
      payoutId: expect.any(String),
      teamId: expect.any(String),
      amountCents: expect.any(Number),
      currency: expect.any(String),
      stripeAccountId: expect.any(String),
      status: 'initiated',
      createdAt: expect.any(Number),
    })
  })

  it('reconciliation rejects overpayment', () => {
    const result = reconcilePayoutLedger(10_000, [7000, 4000])
    expect(result.balanced).toBe(false)
    expect(result.totalNet).toBe(11_000)
  })

  it('reconciliation passes when total net ≤ gross', () => {
    const result = reconcilePayoutLedger(10_000, [3000, 3000, 3000])
    expect(result.balanced).toBe(true)
    expect(result.remainder).toBe(1000)
  })

  it('duplicate payout requests share the same idempotency key', () => {
    const k1 = payoutIdempotencyKey('team-1', 5000, '2026-W23')
    const k2 = payoutIdempotencyKey('team-1', 5000, '2026-W23')
    const k3 = payoutIdempotencyKey('team-1', 5001, '2026-W23')
    expect(k1).toBe(k2)
    expect(k1).not.toBe(k3)
  })
})
