-- 0078_widen_session_mode.sql
-- INCIDENT-2026-07-03 remediation: move the sessions `session_mode` CHECK-widen
-- OFF the request path. This is the offline equivalent of the runtime
-- rebuildSessionsTableForTownhall() in functions/api/lib/session-schema-repair.ts,
-- which performed a live DROP TABLE sessions + full row-copy inside Pages
-- Functions request handlers against shared production D1 — a landmine that
-- could reset D1 storage during any incident.
--
-- SQLite cannot widen a CHECK constraint in place, so the canonical table
-- rebuild is used: create the target table with the widened CHECKs, copy rows
-- (remapping legacy anonymity values and defaulting nullable columns exactly as
-- the runtime rebuild did), drop the old table, rename, recreate indexes.
--
-- Target CHECK sets match the runtime rebuild (the source of truth — note
-- schema.sql itself is behind and lacks 'energizing'/'deliberate'):
--   status      IN ('draft','energizing','live','closed','archived')
--   session_mode IN ('reflection','fun','townhall','stage','retro','ideate','deliberate')

PRAGMA foreign_keys=OFF;

CREATE TABLE sessions__mode_fix (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','energizing','live','closed','archived')),
  anonymity TEXT NOT NULL DEFAULT 'full'
    CHECK (anonymity IN ('full','partial','none','zero_knowledge')),
  vote_policy TEXT NOT NULL DEFAULT 'once'
    CHECK (vote_policy IN ('once','multi','react')),
  session_mode TEXT NOT NULL DEFAULT 'reflection'
    CHECK (session_mode IN ('reflection','fun','townhall','stage','retro','ideate','deliberate')),
  created_at INTEGER NOT NULL,
  started_at INTEGER,
  closed_at INTEGER,
  archived_at INTEGER,
  team_id TEXT DEFAULT NULL,
  workspace_id TEXT,
  workspace_seq INTEGER,
  ai_generated INTEGER NOT NULL DEFAULT 0,
  ai_consent_at INTEGER,
  ai_grounding_hash TEXT,
  ai_accepted_count INTEGER NOT NULL DEFAULT 0,
  ai_dismissed_count INTEGER NOT NULL DEFAULT 0,
  townhall_moderation TEXT CHECK (townhall_moderation IN ('pre','post')),
  is_public INTEGER DEFAULT 1,
  ai_recap_model TEXT,
  ai_recap_edited_at INTEGER
);

INSERT INTO sessions__mode_fix (
  id, owner_id, code, title, status, anonymity, vote_policy, session_mode,
  created_at, started_at, closed_at, archived_at, team_id, workspace_id,
  workspace_seq, ai_generated, ai_consent_at, ai_grounding_hash,
  ai_accepted_count, ai_dismissed_count, townhall_moderation, is_public,
  ai_recap_model, ai_recap_edited_at
)
SELECT
  id, owner_id, code, title, status,
  CASE anonymity WHEN 'anonymous' THEN 'full' WHEN 'identified' THEN 'none' ELSE anonymity END,
  COALESCE(vote_policy, 'once'),
  COALESCE(session_mode, 'reflection'),
  created_at, started_at, closed_at, archived_at,
  team_id, workspace_id, workspace_seq,
  COALESCE(ai_generated, 0), ai_consent_at, ai_grounding_hash,
  COALESCE(ai_accepted_count, 0), COALESCE(ai_dismissed_count, 0),
  townhall_moderation, COALESCE(is_public, 1),
  ai_recap_model, ai_recap_edited_at
FROM sessions;

DROP TABLE sessions;
ALTER TABLE sessions__mode_fix RENAME TO sessions;

CREATE INDEX IF NOT EXISTS idx_sessions_owner ON sessions(owner_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_code ON sessions(code);
CREATE INDEX IF NOT EXISTS idx_sessions_owner_status ON sessions(owner_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_team ON sessions(team_id);
CREATE INDEX IF NOT EXISTS idx_sessions_workspace ON sessions(workspace_id, workspace_seq DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_is_public ON sessions(is_public) WHERE is_public = 1;

PRAGMA foreign_keys=ON;
