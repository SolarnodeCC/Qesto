-- 0002_password_oauth — add password auth + OAuth provider accounts
-- Apply: `wrangler d1 migrations apply qesto_2_db`

PRAGMA foreign_keys = ON;

-- Allow users to have a password (nullable; magic-link-only users have NULL)
ALTER TABLE users ADD COLUMN password_hash TEXT;

-- ─────────────────────────────────────────────────────────────────────────────
-- password_reset_tokens — one-time tokens emailed for password reset
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  token_hash TEXT PRIMARY KEY,                       -- sha-256 of raw token
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,                       -- 1 hour TTL
  consumed_at INTEGER,
  requester_ip TEXT
);
CREATE INDEX IF NOT EXISTS idx_prt_user_expires ON password_reset_tokens(user_id, expires_at);

-- ─────────────────────────────────────────────────────────────────────────────
-- oauth_accounts — link OAuth provider identities to Qesto users
-- A user can have multiple OAuth providers linked to the same account.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS oauth_accounts (
  id TEXT PRIMARY KEY,                               -- ulid
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('google', 'microsoft')),
  provider_user_id TEXT NOT NULL,                    -- stable ID from provider
  provider_email TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_used_at INTEGER NOT NULL,
  UNIQUE(provider, provider_user_id)
);
CREATE INDEX IF NOT EXISTS idx_oauth_user ON oauth_accounts(user_id);
