-- Migration 0008: add vote_policy and session_mode to sessions table.
-- These columns were defined in schema.sql but were never shipped as a migration,
-- so they don't exist in databases created from the 0000_init migration.
-- Apply: `wrangler d1 migrations apply qesto-prod`

ALTER TABLE sessions ADD COLUMN vote_policy TEXT NOT NULL DEFAULT 'once'
  CHECK (vote_policy IN ('once','multi','react'));
ALTER TABLE sessions ADD COLUMN session_mode TEXT NOT NULL DEFAULT 'reflection'
  CHECK (session_mode IN ('reflection','fun'));
