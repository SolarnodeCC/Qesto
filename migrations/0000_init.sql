-- 0000_init — initial D1 schema for Qesto v1 vertical slice.
-- Canonical source: /schema.sql. Keep in sync when the schema changes.
-- Apply: `wrangler d1 migrations apply qesto-prod`

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT,
  created_at INTEGER NOT NULL,
  last_login_at INTEGER,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free','starter','team'))
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

CREATE TABLE IF NOT EXISTS magic_links (
  token_hash TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  consumed_at INTEGER,
  requester_ip TEXT
);
CREATE INDEX IF NOT EXISTS idx_magic_links_email_expires ON magic_links(email, expires_at);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','live','closed','archived')),
  anonymity TEXT NOT NULL DEFAULT 'anonymous'
    CHECK (anonymity IN ('anonymous','identified')),
  created_at INTEGER NOT NULL,
  started_at INTEGER,
  closed_at INTEGER,
  archived_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_sessions_owner ON sessions(owner_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_code ON sessions(code);

CREATE TABLE IF NOT EXISTS questions (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('poll','ranking','consent','open')),
  prompt TEXT NOT NULL,
  options_json TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER NOT NULL,
  UNIQUE(session_id, position)
);
CREATE INDEX IF NOT EXISTS idx_questions_session ON questions(session_id);

CREATE TABLE IF NOT EXISTS votes (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  voter_id TEXT NOT NULL,
  option_id TEXT NOT NULL,
  submitted_at INTEGER NOT NULL,
  UNIQUE(question_id, voter_id)
);
CREATE INDEX IF NOT EXISTS idx_votes_session ON votes(session_id);
CREATE INDEX IF NOT EXISTS idx_votes_question ON votes(question_id);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  ts INTEGER NOT NULL,
  actor_id TEXT,
  actor_ip TEXT,
  action TEXT NOT NULL,
  subject_type TEXT,
  subject_id TEXT,
  meta_json TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_audit_ts ON audit_log(ts);
CREATE INDEX IF NOT EXISTS idx_audit_subject ON audit_log(subject_type, subject_id);
