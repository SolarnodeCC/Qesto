-- Add 'reaction' question kind (ADR-0055, S91)

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
