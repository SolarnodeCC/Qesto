-- jankurai:allow HLT-030-SQL-BAD-BEHAVIOR reason=d1-sqlite-no-concurrent-index expires=2027-06-01
-- 0016_recaps_table — Create recaps table for AI-generated session summaries

CREATE TABLE IF NOT EXISTS recaps (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  team_id TEXT,
  content TEXT NOT NULL,
  ai_generated INTEGER NOT NULL DEFAULT 1,
  format_version INTEGER NOT NULL DEFAULT 1,
  ai_model_version TEXT,
  generated_at INTEGER,
  evidence_json TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_recaps_session ON recaps(session_id);
CREATE INDEX IF NOT EXISTS idx_recaps_team ON recaps(team_id);
CREATE INDEX IF NOT EXISTS idx_recaps_session_format ON recaps(session_id, format_version);
