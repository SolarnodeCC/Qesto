-- 0080_widen_votes_unique.sql
-- Widen the votes uniqueness key from UNIQUE(question_id, voter_id) to
-- UNIQUE(question_id, voter_id, option_id) so multi-vote question kinds
-- (multi_select, upvote, word_cloud — MULTI_VOTE_KINDS in
-- functions/api/lib/session-room-vote.ts) can persist more than one option per
-- voter. Under the old key, the D1 flush (session-room-persistence.ts) hit a
-- UNIQUE constraint on every selection after a voter's first and swallowed it,
-- so the closed-session recap + CSV export (loadSessionVoteMap) silently
-- under-counted those kinds. The live in-DO tally was always correct; this only
-- fixes the durable projection.
--
-- SQLite cannot alter a table-level UNIQUE constraint in place, so the canonical
-- table rebuild is used (create _new with the widened key → copy → drop →
-- rename → recreate indexes), the same proven pattern as 0078/0057/0014.
--
-- Data safety: every existing votes row already satisfies the STRICTER old key
-- (question_id, voter_id), so it is trivially unique under the wider
-- (question_id, voter_id, option_id) key — the row-copy cannot collide and no
-- dedup/data loss is possible.
--
-- foreign_keys is toggled OFF only for the swap and restored below, then the FK
-- graph + page integrity are re-verified with PRAGMA foreign_key_check /
-- quick_check (see end of file).
-- jankurai:migration-safe verify foreign_key_check quick_check

PRAGMA foreign_keys=OFF;

CREATE TABLE votes__unique_fix (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  voter_id TEXT NOT NULL,
  option_id TEXT NOT NULL,
  submitted_at INTEGER NOT NULL,
  UNIQUE(question_id, voter_id, option_id)                     -- one row per (voter, option): multi-vote kinds persist several
);

INSERT INTO votes__unique_fix (id, session_id, question_id, voter_id, option_id, submitted_at)
SELECT id, session_id, question_id, voter_id, option_id, submitted_at FROM votes;

DROP TABLE votes;
ALTER TABLE votes__unique_fix RENAME TO votes;

-- Recreate every votes index the rebuild dropped. These cover recap/export,
-- result aggregation, and voter-scoped lookup paths on production-sized tables.
CREATE INDEX IF NOT EXISTS idx_votes_session ON votes(session_id);
CREATE INDEX IF NOT EXISTS idx_votes_session_id_submitted_at ON votes(session_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_votes_question ON votes(question_id);
CREATE INDEX IF NOT EXISTS idx_votes_session_question ON votes(session_id, question_id);
CREATE INDEX IF NOT EXISTS idx_votes_session_submitted ON votes(session_id, submitted_at);
CREATE INDEX IF NOT EXISTS idx_votes_session_voter ON votes(session_id, voter_id);

PRAGMA foreign_keys=ON;

-- Post-rebuild integrity verification (matches 0078/0057/0014): fail loudly if
-- the votes foreign-key graph was disturbed by the rebuild-with-FKs-off swap.
PRAGMA foreign_key_check;
PRAGMA quick_check;
