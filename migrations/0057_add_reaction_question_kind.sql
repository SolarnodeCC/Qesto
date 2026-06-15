-- Add 'reaction' question kind (ADR-0055, S91)
-- Recreates questions table with expanded CHECK constraint (adds 'reaction').
-- Data preservation: create new table, copy existing data, rename (SQLite-safe).
-- Mirrors the proven 0014 questions rebuild, including post-rebuild integrity checks.
-- jankurai:migration-safe verify foreign_key_check quick_check

CREATE TABLE IF NOT EXISTS questions_new (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN (
    'poll', 'ranking', 'consent', 'open', 'word_cloud',
    'multi_select', 'likert', 'upvote', 'slider', 'reaction'
  )),
  prompt TEXT NOT NULL,
  options_json TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER NOT NULL,
  UNIQUE(session_id, position)
);

INSERT INTO questions_new (id, session_id, position, kind, prompt, options_json, created_at)
SELECT id, session_id, position, kind, prompt, options_json, created_at FROM questions;

DROP TABLE questions;
ALTER TABLE questions_new RENAME TO questions;

CREATE INDEX IF NOT EXISTS idx_questions_session ON questions(session_id);
CREATE INDEX IF NOT EXISTS idx_questions_session_position ON questions(session_id, position);

-- Post-rebuild integrity verification (matches 0014): fail loudly if the
-- questions/votes foreign-key graph was disturbed by the table swap.
PRAGMA foreign_key_check;
PRAGMA quick_check;
