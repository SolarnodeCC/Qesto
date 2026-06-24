import { describe, expect, it } from 'vitest'
import {
  computeNetEarningsCents,
  computeOutstandingPayoutCents,
  findPayoutByIdempotencyKey,
  recordPayout,
  currentPayoutPeriod,
} from '../../functions/api/lib/marketplace-payout-ledger'
import { payoutIdempotencyKey, splitMarketplacePayout } from '../../functions/api/lib/marketplace-payout'

// #588 — the payout route must compute the owed amount server-side. These tests
// exercise the ledger that backs that balance check + idempotency.

type Purchase = { partner_team_id: string; amount_cents: number; revenue_share_bps: number; refunded: boolean }
type Payout = {
  id: string
  team_id: string
  idempotency_key: string
  amount_cents: number
  currency: string
  stripe_account_id: string
  stripe_transfer_id: string | null
  status: string
  created_at: number
}

function makeDb(purchases: Purchase[], payouts: Payout[] = []) {
  function prepare(sql: string) {
    const s = sql.trim().replace(/\s+/g, ' ')
    let bound: unknown[] = []
    const api = {
      bind(...args: unknown[]) {
        bound = args
        return api
      },
      async all<T>(): Promise<{ results: T[] }> {
        // computeNetEarningsCents join query
        if (s.includes('FROM marketplace_purchases')) {
          const teamId = bound[0]
          const rows = purchases
            .filter((p) => p.partner_team_id === teamId && !p.refunded)
            .map((p) => ({ amount_cents: p.amount_cents, revenue_share_bps: p.revenue_share_bps }))
          return { results: rows as unknown as T[] }
        }
        return { results: [] }
      },
      async first<T>(): Promise<T | null> {
        // sumCommittedPayoutsCents
        if (s.includes('SUM(amount_cents)')) {
          const teamId = bound[0]
          const total = payouts
            .filter((p) => p.team_id === teamId && ['pending', 'initiated', 'paid'].includes(p.status))
            .reduce((sum, p) => sum + p.amount_cents, 0)
          return { total } as unknown as T
        }
        // findPayoutByIdempotencyKey
        if (s.includes('WHERE idempotency_key')) {
          const key = bound[0]
          return (payouts.find((p) => p.idempotency_key === key) ?? null) as unknown as T
        }
        return null
      },
      async run() {
        // recordPayout INSERT
        if (s.startsWith('INSERT INTO marketplace_payouts')) {
          const [id, team_id, idempotency_key, amount_cents, currency, stripe_account_id, stripe_transfer_id, status, created_at] =
            bound as [string, string, string, number, string, string, string | null, string, number]
          if (!payouts.some((p) => p.idempotency_key === idempotency_key)) {
            payouts.push({ id, team_id, idempotency_key, amount_cents, currency, stripe_account_id, stripe_transfer_id, status, created_at })
          }
        }
        return { success: true }
      },
    }
    return api
  }
  return { prepare } as unknown as D1Database
}

describe('marketplace payout ledger (#588)', () => {
  it('computes net earnings net of each listing revenue share', async () => {
    const db = makeDb([
      { partner_team_id: 't1', amount_cents: 10_000, revenue_share_bps: 7000, refunded: false },
      { partner_team_id: 't1', amount_cents: 5_000, revenue_share_bps: 7000, refunded: false },
      { partner_team_id: 't2', amount_cents: 99_999, revenue_share_bps: 7000, refunded: false }, // other team
    ])
    const expected =
      splitMarketplacePayout(10_000, 7000).netCents + splitMarketplacePayout(5_000, 7000).netCents
    expect(await computeNetEarningsCents(db, 't1')).toBe(expected)
  })

  it('excludes refunded purchases from the balance', async () => {
    const db = makeDb([
      { partner_team_id: 't1', amount_cents: 10_000, revenue_share_bps: 7000, refunded: false },
      { partner_team_id: 't1', amount_cents: 10_000, revenue_share_bps: 7000, refunded: true },
    ])
    expect(await computeNetEarningsCents(db, 't1')).toBe(splitMarketplacePayout(10_000, 7000).netCents)
  })

  it('outstanding balance subtracts already-committed payouts and never goes negative', async () => {
    const net = splitMarketplacePayout(10_000, 7000).netCents
    const db = makeDb(
      [{ partner_team_id: 't1', amount_cents: 10_000, revenue_share_bps: 7000, refunded: false }],
      [
        {
          id: 'p1',
          team_id: 't1',
          idempotency_key: 'k1',
          amount_cents: net,
          currency: 'eur',
          stripe_account_id: 'acct',
          stripe_transfer_id: 'tr_1',
          status: 'initiated',
          created_at: 1,
        },
      ],
    )
    // Everything earned has already been paid out → nothing outstanding.
    expect(await computeOutstandingPayoutCents(db, 't1')).toBe(0)
  })

  it('records a payout idempotently (same key does not duplicate)', async () => {
    const payouts: Payout[] = []
    const db = makeDb([], payouts)
    const key = payoutIdempotencyKey('t1', 5000, currentPayoutPeriod(0))
    const record = {
      id: 'p1',
      team_id: 't1',
      idempotency_key: key,
      amount_cents: 5000,
      currency: 'eur',
      stripe_account_id: 'acct',
      stripe_transfer_id: 'tr_1',
      status: 'initiated' as const,
    }
    await recordPayout(db, record)
    await recordPayout(db, { ...record, id: 'p2', stripe_transfer_id: 'tr_2' })
    expect(payouts).toHaveLength(1)
    const found = await findPayoutByIdempotencyKey(db, key)
    expect(found?.stripe_transfer_id).toBe('tr_1')
  })

  it('idempotency key is stable for the same team/period/amount', () => {
    expect(payoutIdempotencyKey('t1', 5000, '2026-06')).toBe(payoutIdempotencyKey('t1', 5000, '2026-06'))
    expect(payoutIdempotencyKey('t1', 5000, '2026-06')).not.toBe(payoutIdempotencyKey('t1', 5001, '2026-06'))
  })
})
