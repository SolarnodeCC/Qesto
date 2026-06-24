-- #585 — entitlement reconciliation from Stripe webhooks.
-- Adds a queryable Stripe customer id to users so webhook handlers can resolve
-- the paying user without scanning KV. The KV reverse index remains as a
-- fallback / cache. Nullable; backfilled lazily when checkout completes.

ALTER TABLE users ADD COLUMN stripe_customer_id TEXT;

CREATE INDEX IF NOT EXISTS idx_users_stripe_customer_id ON users(stripe_customer_id);

PRAGMA foreign_key_check;
PRAGMA quick_check;
