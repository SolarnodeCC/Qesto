-- 0011_add_users_suspended_at — add suspended_at column to users table.
-- schema.sql has this column since Phase 8 but it was missing from 0000_init.sql.
-- Apply: `wrangler d1 migrations apply qesto-prod`

ALTER TABLE users ADD COLUMN suspended_at INTEGER;
CREATE INDEX IF NOT EXISTS idx_users_suspended ON users(suspended_at);
