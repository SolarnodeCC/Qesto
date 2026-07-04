-- 0077_stripe_webhook_events.sql
-- Stripe webhook idempotency and audit trail
-- Prevents duplicate processing of Stripe webhook events and tracks delivery history.
-- NOTE: duplicate of 0060_stripe_webhook_events.sql. The table statement was
-- already idempotent, but the bare CREATE INDEX statements failed on every
-- database that applied 0060, blocking all later migrations on fresh clones.
-- IF NOT EXISTS makes this migration a safe no-op everywhere.

CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  stripe_event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  processed_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_event_type ON stripe_webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_created_at ON stripe_webhook_events(created_at DESC);
