-- Migration 0049: Marketplace partner billing foundation (E82, MARKETPLACE-BILLING-SPIKE-02, Sprint 82).
-- Apply: wrangler d1 migrations apply qesto_3_db --local
-- Safety: new table only. No destructive change.
--
-- One Stripe Connect payment account per partner team (MARKETPLACE-CONNECT-01).
-- Charges/payouts gating mirrors Stripe's `charges_enabled` / `payouts_enabled`
-- so the read path never needs a live Stripe round-trip to decide eligibility.

CREATE TABLE IF NOT EXISTS partner_payment_accounts (
  team_id TEXT PRIMARY KEY,
  stripe_account_id TEXT,
  account_type TEXT NOT NULL DEFAULT 'express'
    CHECK (account_type IN ('express', 'standard', 'custom')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'onboarding', 'verified', 'restricted', 'disabled')),
  charges_enabled INTEGER NOT NULL DEFAULT 0,
  payouts_enabled INTEGER NOT NULL DEFAULT 0,
  default_payout_currency TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_partner_payment_accounts_account
  ON partner_payment_accounts(stripe_account_id);
