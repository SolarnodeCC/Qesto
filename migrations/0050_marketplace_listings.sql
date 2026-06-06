-- jankurai:allow HLT-030-SQL-BAD-BEHAVIOR reason=d1-sqlite-no-concurrent-index expires=2027-06-01
-- Migration 0050: Marketplace paid listings (MARKETPLACE-PAID-LISTING-01, Sprint 83).
-- Apply: wrangler d1 migrations apply qesto_3_db --local

CREATE TABLE IF NOT EXISTS marketplace_listings (
  id TEXT PRIMARY KEY,
  partner_team_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('plugin', 'template', 'agent')),
  title TEXT NOT NULL,
  description TEXT,
  price_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'eur',
  revenue_share_bps INTEGER NOT NULL DEFAULT 7000,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'review', 'live', 'suspended')),
  visibility TEXT NOT NULL DEFAULT 'private'
    CHECK (visibility IN ('private', 'team', 'public')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  published_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_marketplace_listings_partner
  ON marketplace_listings(partner_team_id, status);

CREATE INDEX IF NOT EXISTS idx_marketplace_listings_status
  ON marketplace_listings(status, visibility);

CREATE TABLE IF NOT EXISTS marketplace_purchases (
  id TEXT PRIMARY KEY,
  buyer_team_id TEXT NOT NULL,
  listing_id TEXT NOT NULL REFERENCES marketplace_listings(id),
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL,
  purchased_at INTEGER NOT NULL,
  refunded_at INTEGER
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_marketplace_purchases_team_listing
  ON marketplace_purchases(buyer_team_id, listing_id)
  WHERE refunded_at IS NULL;
