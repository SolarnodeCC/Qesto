-- jankurai:allow HLT-030-SQL-BAD-BEHAVIOR reason=d1-sqlite-no-concurrent-index expires=2027-06-01
-- Migration 0052: STAGE session mode + recurring workspaces (Sprint 85).
-- Apply: wrangler d1 migrations apply qesto_3_db --local

-- STAGE-FOUNDATION-01: hybrid-event session mode (draft-only configuration).
-- SQLite cannot ALTER CHECK constraints; new sessions use application validation.
-- Existing rows remain valid; stage mode enforced in API layer.

CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('retro', 'ideate')),
  title TEXT NOT NULL,
  template_json TEXT NOT NULL DEFAULT '{}',
  created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_workspaces_team_kind ON workspaces(team_id, kind, updated_at DESC);
