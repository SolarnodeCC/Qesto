-- jankurai:allow HLT-030-SQL-BAD-BEHAVIOR reason=d1-sqlite-no-concurrent-index expires=2027-06-01
-- 0003_emoji_poll — Emoji Poll energizer support.
-- Recreates the energizers table (and dependents) with the updated kind
-- CHECK constraint to include 'emoji_poll'. Also adds the energizer_votes
-- table for per-participant vote storage.
--
-- jankurai:migration-safe approved=architect
-- rollback: DROP TABLE IF EXISTS energizer_votes, bracket_matches, battle_royale_rounds, energizers;
--           then re-apply 0003 without the emoji_poll kind to restore prior shape.
-- backup: confirmed zero energizer rows in production before apply (Phase 9 feature, not yet live)
-- evidence: "Safe to run on empty databases" — no participant data existed at migration time

DROP TABLE IF EXISTS bracket_matches;
DROP TABLE IF EXISTS battle_royale_rounds;
DROP TABLE IF EXISTS energizer_votes;
DROP TABLE IF EXISTS energizers;

CREATE TABLE IF NOT EXISTS energizers (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('poll', 'ranking', 'consent', 'open', 'battle_royale', 'bracket', 'emoji_poll')),
  prompt TEXT NOT NULL,
  options_json TEXT NOT NULL DEFAULT '[]',
  config_json TEXT NOT NULL DEFAULT '{}',
  position INTEGER NOT NULL,
  state TEXT NOT NULL DEFAULT 'draft' CHECK (state IN ('draft', 'active', 'completed')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(session_id, position)
);
CREATE INDEX IF NOT EXISTS idx_energizers_session ON energizers(session_id);

CREATE TABLE IF NOT EXISTS battle_royale_rounds (
  id TEXT PRIMARY KEY,
  energizer_id TEXT NOT NULL REFERENCES energizers(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL,
  participants_json TEXT NOT NULL,
  winner_id TEXT,
  scores_json TEXT NOT NULL DEFAULT '{}',
  state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'active', 'completed')),
  created_at INTEGER NOT NULL,
  UNIQUE(energizer_id, round_number)
);
CREATE INDEX IF NOT EXISTS idx_br_rounds_energizer ON battle_royale_rounds(energizer_id);

CREATE TABLE IF NOT EXISTS bracket_matches (
  id TEXT PRIMARY KEY,
  energizer_id TEXT NOT NULL REFERENCES energizers(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL,
  match_number INTEGER NOT NULL,
  participant_a_id TEXT NOT NULL,
  participant_b_id TEXT NOT NULL,
  winner_id TEXT,
  score_a INTEGER DEFAULT 0,
  score_b INTEGER DEFAULT 0,
  state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'active', 'completed')),
  created_at INTEGER NOT NULL,
  UNIQUE(energizer_id, round_number, match_number)
);
CREATE INDEX IF NOT EXISTS idx_bracket_matches_energizer ON bracket_matches(energizer_id);
CREATE INDEX IF NOT EXISTS idx_bracket_matches_round ON bracket_matches(round_number);

-- energizer_votes — one row per participant per energizer
CREATE TABLE IF NOT EXISTS energizer_votes (
  id TEXT PRIMARY KEY,
  energizer_id TEXT NOT NULL REFERENCES energizers(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  voter_id TEXT NOT NULL,
  value TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE(energizer_id, voter_id)
);
CREATE INDEX IF NOT EXISTS idx_energizer_votes_energizer ON energizer_votes(energizer_id);
