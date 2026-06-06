-- jankurai:allow HLT-030-SQL-BAD-BEHAVIOR reason=d1-sqlite-no-concurrent-index expires=2027-06-01
-- Migration 0048: Native push device tokens (NATIVE-PUSH-01 / ADR-0044, Sprint 81).
-- Apply: wrangler d1 migrations apply qesto_3_db --local

CREATE TABLE IF NOT EXISTS device_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  token TEXT NOT NULL,
  app_version TEXT,
  locale TEXT,
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  revoked_at INTEGER
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_device_tokens_user_platform_token
  ON device_tokens(user_id, platform, token)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_device_tokens_user_active
  ON device_tokens(user_id, revoked_at);
