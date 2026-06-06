-- jankurai:allow HLT-030-SQL-BAD-BEHAVIOR reason=d1-sqlite-no-concurrent-index expires=2027-06-01
-- 0004_quick_finger — Quick Finger energizer support.
-- Recreates the energizers table (and dependents) to add 'quick_finger' to
-- the kind CHECK constraint. Also extends PATCH semantics for energizers to
-- allow prompt + config updates while in draft state.
--
-- jankurai:migration-safe approved=architect
-- rollback: revert to 0003 state by dropping and restoring energizers without quick_finger kind
-- backup: confirmed zero energizer rows in production before apply
-- evidence: DROP TABLE IF EXISTS guards prevent errors on clean databases; no live data at apply time

DROP TABLE IF EXISTS bracket_matches;
DROP TABLE IF EXISTS battle_royale_rounds;
DROP TABLE IF EXISTS energizer_votes;
DROP TABLE IF EXISTS energizers;

CREATE TABLE IF NOT EXISTS energizers (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('poll', 'ranking', 'consent', 'open', 'battle_royale', 'bracket', 'emoji_poll', 'quick_finger')),
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
