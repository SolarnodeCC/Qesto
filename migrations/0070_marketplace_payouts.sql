-- #588 — marketplace payout ledger.
--
-- The payout route previously sent a caller-controlled amount straight to Stripe
-- with no balance check and no idempotency. This table records every payout so
-- the route can (a) cap a transfer at the partner's verified outstanding balance
-- (net earnings − already-committed payouts) and (b) deduplicate retries via the
-- stable idempotency key (UNIQUE).

CREATE TABLE IF NOT EXISTS marketplace_payouts (
  id TEXT PRIMARY KEY,                                          -- ulid
  team_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,                         -- payout:<team>:<period>:<amount>
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL,
  stripe_account_id TEXT NOT NULL,
  stripe_transfer_id TEXT,                                      -- set once Stripe accepts the transfer
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'initiated', 'paid', 'failed')),
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_marketplace_payouts_team_status ON marketplace_payouts(team_id, status);

PRAGMA foreign_key_check;
PRAGMA quick_check;
