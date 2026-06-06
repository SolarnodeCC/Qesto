-- jankurai:allow HLT-030-SQL-BAD-BEHAVIOR reason=d1-sqlite-no-concurrent-index expires=2027-06-01
-- Help Assistant tables (Week 1 schema)
CREATE TABLE IF NOT EXISTS help_documents (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  topic TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'free',
  excerpt TEXT,
  embedding_id TEXT UNIQUE,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  published_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_help_documents_topic ON help_documents(topic);
CREATE INDEX IF NOT EXISTS idx_help_documents_scope ON help_documents(scope);

CREATE TABLE IF NOT EXISTS help_feedback (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  document_id TEXT NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  helpful INTEGER NOT NULL,
  feedback_text TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_help_feedback_document ON help_feedback(document_id);
CREATE INDEX IF NOT EXISTS idx_help_feedback_helpful ON help_feedback(helpful);
CREATE INDEX IF NOT EXISTS idx_help_feedback_created ON help_feedback(created_at);

CREATE TABLE IF NOT EXISTS help_prompt_versions (
  id TEXT PRIMARY KEY,
  version INTEGER NOT NULL,
  content TEXT NOT NULL,
  trigger_event TEXT,
  triggered_by TEXT,
  topic TEXT,
  active INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_help_prompt_active ON help_prompt_versions(active);
CREATE INDEX IF NOT EXISTS idx_help_prompt_topic ON help_prompt_versions(topic, active);

CREATE TABLE IF NOT EXISTS help_documents_review_queue (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  downvote_count INTEGER NOT NULL,
  period_days INTEGER NOT NULL,
  flagged_at INTEGER NOT NULL,
  reviewed_at INTEGER,
  reviewed_by TEXT,
  action TEXT,
  UNIQUE(document_id, period_days)
);
