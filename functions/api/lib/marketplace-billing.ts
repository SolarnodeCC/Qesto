/**
 * Marketplace partner billing repository (E82, MARKETPLACE-BILLING-SPIKE-02, Sprint 82).
 *
 * One Stripe Connect payment account per partner team. The local row caches the
 * Stripe verification state (`charges_enabled` / `payouts_enabled`) so the read
 * and payout-eligibility paths never need a live Stripe round-trip.
 */
import type { D1Database } from '@cloudflare/workers-types'

export const PARTNER_ACCOUNT_STATUSES = [
  'pending',
  'onboarding',
  'verified',
  'restricted',
  'disabled',
] as const
export type PartnerAccountStatus = (typeof PARTNER_ACCOUNT_STATUSES)[number]

export type PartnerPaymentAccountRow = {
  team_id: string
  stripe_account_id: string | null
  account_type: 'express' | 'standard' | 'custom'
  status: PartnerAccountStatus
  charges_enabled: number
  payouts_enabled: number
  default_payout_currency: string | null
  created_at: number
  updated_at: number
}

export type PartnerPaymentAccount = {
  teamId: string
  stripeAccountId: string | null
  accountType: 'express' | 'standard' | 'custom'
  status: PartnerAccountStatus
  chargesEnabled: boolean
  payoutsEnabled: boolean
  defaultPayoutCurrency: string | null
  createdAt: number
  updatedAt: number
}

function rowToAccount(row: PartnerPaymentAccountRow): PartnerPaymentAccount {
  return {
    teamId: row.team_id,
    stripeAccountId: row.stripe_account_id,
    accountType: row.account_type,
    status: row.status,
    chargesEnabled: row.charges_enabled === 1,
    payoutsEnabled: row.payouts_enabled === 1,
    defaultPayoutCurrency: row.default_payout_currency,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function getPartnerAccount(
  db: D1Database,
  teamId: string,
): Promise<PartnerPaymentAccount | null> {
  const row = await db
    .prepare(
      `SELECT team_id, stripe_account_id, account_type, status, charges_enabled,
              payouts_enabled, default_payout_currency, created_at, updated_at
         FROM partner_payment_accounts
        WHERE team_id = ?1`,
    )
    .bind(teamId)
    .first<PartnerPaymentAccountRow>()
  return row ? rowToAccount(row) : null
}

/** Create the partner account shell when onboarding starts (idempotent on team_id). */
export async function createPartnerAccount(
  db: D1Database,
  params: {
    teamId: string
    stripeAccountId: string | null
    accountType?: 'express' | 'standard' | 'custom'
  },
): Promise<void> {
  const now = Date.now()
  await db
    .prepare(
      `INSERT INTO partner_payment_accounts
         (team_id, stripe_account_id, account_type, status, charges_enabled,
          payouts_enabled, default_payout_currency, created_at, updated_at)
       VALUES (?1, ?2, ?3, 'onboarding', 0, 0, NULL, ?4, ?4)
       ON CONFLICT(team_id) DO UPDATE SET
         stripe_account_id = COALESCE(excluded.stripe_account_id, partner_payment_accounts.stripe_account_id),
         account_type = excluded.account_type,
         updated_at = excluded.updated_at`,
    )
    .bind(params.teamId, params.stripeAccountId, params.accountType ?? 'express', now)
    .run()
}

/** Reconcile the cached verification state from a Stripe account snapshot. */
export async function updatePartnerAccountState(
  db: D1Database,
  params: {
    teamId: string
    status: PartnerAccountStatus
    chargesEnabled: boolean
    payoutsEnabled: boolean
    defaultPayoutCurrency?: string | null
  },
): Promise<void> {
  await db
    .prepare(
      `UPDATE partner_payment_accounts
          SET status = ?2,
              charges_enabled = ?3,
              payouts_enabled = ?4,
              default_payout_currency = ?5,
              updated_at = ?6
        WHERE team_id = ?1`,
    )
    .bind(
      params.teamId,
      params.status,
      params.chargesEnabled ? 1 : 0,
      params.payoutsEnabled ? 1 : 0,
      params.defaultPayoutCurrency ?? null,
      Date.now(),
    )
    .run()
}

/** Derive a stable, PII-free verification status from a Stripe account payload. */
export function deriveAccountStatus(account: {
  charges_enabled?: boolean
  payouts_enabled?: boolean
  details_submitted?: boolean
  requirements?: { disabled_reason?: string | null } | null
}): PartnerAccountStatus {
  if (account.requirements?.disabled_reason) return 'restricted'
  if (account.charges_enabled && account.payouts_enabled) return 'verified'
  if (account.details_submitted) return 'onboarding'
  return 'pending'
}
