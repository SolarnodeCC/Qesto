-- 0077_stripe_webhook_events.sql
-- Stripe webhook idempotency and audit trail
-- Prevents duplicate processing of Stripe webhook events and tracks delivery history.

CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  stripe_event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  processed_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX idx_stripe_webhook_events_event_type ON stripe_webhook_events(event_type);
CREATE INDEX idx_stripe_webhook_events_created_at ON stripe_webhook_events(created_at DESC);
