/**
 * Marketplace payout LEDGER (D1-backed) — #588.
 *
 * The payout route must NEVER trust a client-supplied amount. The owed balance is
 * computed server-side from realised, non-refunded sales of the partner's own
 * listings (net of the platform revenue share), minus payouts already initiated
 * or paid. Combines with the pure split helpers in `marketplace-payout.ts`.
 */
import { splitMarketplacePayout } from './marketplace-payout'

export type MarketplacePayoutRow = {
  id: string
  team_id: string
  idempotency_key: string
  amount_cents: number
  currency: string
  stripe_account_id: string
  stripe_transfer_id: string | null
  status: 'pending' | 'initiated' | 'paid' | 'failed'
  created_at: number
}

type PurchaseEarningRow = { amount_cents: number; revenue_share_bps: number }

/**
 * Sum of the partner's net earnings across all non-refunded purchases of listings
 * they own, applying each listing's own revenue-share split.
 */
export async function computeNetEarningsCents(db: D1Database, teamId: string): Promise<number> {
  const { results } = await db
    .prepare(
      `SELECT p.amount_cents AS amount_cents, l.revenue_share_bps AS revenue_share_bps
         FROM marketplace_purchases p
         JOIN marketplace_listings l ON l.id = p.listing_id
        WHERE l.partner_team_id = ?1 AND p.refunded_at IS NULL`,
    )
    .bind(teamId)
    .all<PurchaseEarningRow>()
  return (results ?? []).reduce(
    (sum, row) => sum + splitMarketplacePayout(row.amount_cents, row.revenue_share_bps).netCents,
    0,
  )
}

/** Sum of payouts already committed (initiated or paid) — failed payouts don't count. */
export async function sumCommittedPayoutsCents(db: D1Database, teamId: string): Promise<number> {
  const row = await db
    .prepare(
      `SELECT COALESCE(SUM(amount_cents), 0) AS total
         FROM marketplace_payouts
        WHERE team_id = ?1 AND status IN ('pending', 'initiated', 'paid')`,
    )
    .bind(teamId)
    .first<{ total: number }>()
  return row?.total ?? 0
}

/** Outstanding payable balance = net earnings − already-committed payouts (never < 0). */
export async function computeOutstandingPayoutCents(db: D1Database, teamId: string): Promise<number> {
  const [earned, paid] = await Promise.all([
    computeNetEarningsCents(db, teamId),
    sumCommittedPayoutsCents(db, teamId),
  ])
  return Math.max(0, earned - paid)
}

/** Idempotent lookup of a prior payout by its stable idempotency key. */
export async function findPayoutByIdempotencyKey(
  db: D1Database,
  idempotencyKey: string,
): Promise<MarketplacePayoutRow | null> {
  return db
    .prepare(`SELECT * FROM marketplace_payouts WHERE idempotency_key = ?1 LIMIT 1`)
    .bind(idempotencyKey)
    .first<MarketplacePayoutRow>()
}

/** Persist a payout record (the ledger row that backs balance reconciliation). */
export async function recordPayout(
  db: D1Database,
  record: Omit<MarketplacePayoutRow, 'created_at'> & { created_at?: number },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO marketplace_payouts
         (id, team_id, idempotency_key, amount_cents, currency, stripe_account_id, stripe_transfer_id, status, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
       ON CONFLICT(idempotency_key) DO NOTHING`,
    )
    .bind(
      record.id,
      record.team_id,
      record.idempotency_key,
      record.amount_cents,
      record.currency,
      record.stripe_account_id,
      record.stripe_transfer_id,
      record.status,
      record.created_at ?? Date.now(),
    )
    .run()
}

/** Calendar-month period token (UTC) used in the payout idempotency key. */
export function currentPayoutPeriod(now: number = Date.now()): string {
  const d = new Date(now)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}
