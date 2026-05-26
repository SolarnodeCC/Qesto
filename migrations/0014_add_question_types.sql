-- 0014_add_question_types — Support multi_select, likert, upvote, slider question types.
-- Recreates questions table with expanded CHECK constraint including 9 total kinds.
-- Data preservation: Creates new table, copies existing data, renames (SQLite-safe).

-- Step 1: Create new questions table with all 9 supported kinds
CREATE TABLE IF NOT EXISTS questions_new (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN (
    'poll', 'ranking', 'consent', 'open', 'word_cloud',
    'multi_select', 'likert', 'upvote', 'slider'
  )),
  prompt TEXT NOT NULL,
  options_json TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER NOT NULL,
  UNIQUE(session_id, position)
);

-- Step 2: Copy existing data from old table to new table
INSERT INTO questions_new (id, session_id, position, kind, prompt, options_json, created_at)
SELECT id, session_id, position, kind, prompt, options_json, created_at
FROM questions;

-- Step 3: Drop old table
DROP TABLE questions;

-- Step 4: Rename new table to original name
ALTER TABLE questions_new RENAME TO questions;

-- Step 5: Recreate indexes (same as original schema)
CREATE INDEX IF NOT EXISTS idx_questions_session ON questions(session_id);
CREATE INDEX IF NOT EXISTS idx_questions_session_position ON questions(session_id, position);

-- Post-rebuild integrity verification (HLT-030)
-- jankurai:migration-safe verify foreign_key_check quick_check
PRAGMA foreign_key_check;
PRAGMA quick_check;
