-- Migration 0046: TOWNHALL Moderated Anonymous Q&A (epic TOWNHALL, ADR-0044).
-- Apply: `wrangler d1 migrations apply qesto-prod`
-- Safety: additive column + new table + additive indexes. No data backfill.
-- jankurai:migration-safe approved=architect

SET lock_timeout = '5s';
SET statement_timeout = '30s';

-- (1) Per-session townhall moderation mode. Additive, NULL unless mode='townhall'.
ALTER TABLE sessions ADD COLUMN townhall_moderation TEXT
  CHECK (townhall_moderation IN ('pre','post'));

-- (2) Audience-submitted Q&A board, persist-on-close archive + GDPR erasure tier.
CREATE TABLE IF NOT EXISTS townhall_questions (
  id            TEXT PRIMARY KEY,
  session_id    TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  body          TEXT NOT NULL,
  display_name  TEXT,
  author_hash   TEXT NOT NULL,
  status        TEXT NOT NULL
                  CHECK (status IN ('pending','approved','dismissed','answered','grouped')),
  upvotes       INTEGER NOT NULL DEFAULT 0,
  group_parent  TEXT,
  was_spotlit   INTEGER NOT NULL DEFAULT 0,
  created_at    INTEGER NOT NULL,
  resolved_at   INTEGER,
  FOREIGN KEY (group_parent) REFERENCES townhall_questions(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_townhall_q_session ON townhall_questions(session_id, status);
CREATE INDEX IF NOT EXISTS idx_townhall_q_author ON townhall_questions(author_hash);

-- (3) CHECK-enum widenings are canonical in schema.sql (SQLite cannot ALTER a CHECK
-- constraint in place; fresh DBs initialize from schema.sql). Documented per the
-- 0008/0009/0010 precedent:
--   sessions.session_mode  += 'townhall'
--   sessions.anonymity     += 'zero_knowledge'   (resolves the long-standing
--                                                  types.ts vs schema.sql discrepancy)
-- Old databases that enforce the narrower CHECK require a table rebuild to widen it;
-- new databases already have the correct constraint from schema.sql.

RESET lock_timeout;
RESET statement_timeout;
