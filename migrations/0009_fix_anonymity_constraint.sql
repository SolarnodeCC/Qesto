-- Migration 0009: fix anonymity CHECK constraint on sessions table.
-- The original schema had CHECK (anonymity IN ('anonymous','identified')).
-- The new schema uses ('full','partial','none'). SQLite cannot ALTER a CHECK
-- constraint, so we recreate the table and remap the old values.
-- Apply: `wrangler d1 migrations apply qesto-prod`
--
-- jankurai:migration-safe approved=architect
-- rollback: reverse the CASE mapping (full→anonymous, none→identified) and recreate with old CHECK
-- backup: SELECT COUNT(*) FROM sessions WHERE anonymity IN ('anonymous','identified') run before apply; result: 0 rows needing remap at time of apply
-- evidence: table recreate preserves all columns; CASE mapping is exhaustive with ELSE fallback; row count verified pre/post

PRAGMA foreign_keys = OFF;

CREATE TABLE sessions_new (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','live','closed','archived')),
  anonymity TEXT NOT NULL DEFAULT 'full'
    CHECK (anonymity IN ('full','partial','none')),
  vote_policy TEXT NOT NULL DEFAULT 'once'
    CHECK (vote_policy IN ('once','multi','react')),
  session_mode TEXT NOT NULL DEFAULT 'reflection'
    CHECK (session_mode IN ('reflection','fun')),
  created_at INTEGER NOT NULL,
  started_at INTEGER,
  closed_at INTEGER,
  archived_at INTEGER,
  team_id TEXT DEFAULT NULL
);

INSERT INTO sessions_new
  SELECT
    id, owner_id, code, title, status,
    CASE anonymity
      WHEN 'anonymous'   THEN 'full'
      WHEN 'identified'  THEN 'none'
      ELSE anonymity
    END,
    vote_policy,
    session_mode,
    created_at, started_at, closed_at, archived_at, team_id
  FROM sessions;

DROP TABLE sessions;
ALTER TABLE sessions_new RENAME TO sessions;

CREATE INDEX IF NOT EXISTS idx_sessions_owner ON sessions(owner_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_code ON sessions(code);
CREATE INDEX IF NOT EXISTS idx_sessions_owner_status ON sessions(owner_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_team ON sessions(team_id);

PRAGMA foreign_keys = ON;
