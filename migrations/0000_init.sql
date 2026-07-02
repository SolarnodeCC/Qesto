-- 0000_init — initial D1 schema for Qesto v1 vertical slice.
-- Canonical source: /schema.sql. Keep in sync when the schema changes.
-- Apply: `wrangler d1 migrations apply qesto-prod`
--
-- jankurai:migration-safe approved=architect
-- rollback: drop all tables (fresh install only; no production data exists at this point)
-- backup: n/a — initial schema, no pre-existing rows
-- evidence: CREATE TABLE IF NOT EXISTS guards make this idempotent; re-running is safe

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT,
  created_at INTEGER NOT NULL,
  last_login_at INTEGER,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free','starter','team')),
  -- suspended_at exists in schema.sql but was never added by a migration
  -- (same TD-03 class as sessions.team_id above). CREATE TABLE IF NOT EXISTS
  -- no-ops on any DB where users already exists.
  suspended_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_suspended ON users(suspended_at);

CREATE TABLE IF NOT EXISTS magic_links (
  token_hash TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  consumed_at INTEGER,
  requester_ip TEXT
);
CREATE INDEX IF NOT EXISTS idx_magic_links_email_expires ON magic_links(email, expires_at);

-- TD-03 / #407 (2026-06-29): anonymity/vote_policy/session_mode/ai_* below were
-- widened/added to match schema.sql. The 0008/0009/0010/0046 no-ops assumed
-- "fresh DBs initialize from schema.sql" — but DEPLOY_BOOTSTRAP.md and
-- `e2e:db:local` both replay this file, where that assumption doesn't hold:
-- a from-scratch replay was missing 7 columns and stuck on the legacy CHECK.
-- Safe everywhere else: CREATE TABLE IF NOT EXISTS no-ops the whole statement
-- (team_id default and column set included) on any DB where sessions already
-- exists, exactly like the team_id fix above it did.
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','live','closed','archived')),
  anonymity TEXT NOT NULL DEFAULT 'full'
    CHECK (anonymity IN ('full','partial','none','zero_knowledge')),
  vote_policy TEXT NOT NULL DEFAULT 'once'
    CHECK (vote_policy IN ('once','multi','react')),
  session_mode TEXT NOT NULL DEFAULT 'reflection'
    CHECK (session_mode IN ('reflection','fun','townhall','stage','retro','ideate')),
  created_at INTEGER NOT NULL,
  started_at INTEGER,
  closed_at INTEGER,
  archived_at INTEGER,
  -- team_id exists in schema.sql's sessions table but was never added by a
  -- migration (TD-03 drift), so a from-scratch replay failed at the 0045
  -- team_id index. Included here so replay matches prod. Safe: 0000 is already
  -- applied on prod, and CREATE TABLE IF NOT EXISTS is a no-op on existing DBs.
  team_id TEXT DEFAULT NULL,
  ai_generated INTEGER NOT NULL DEFAULT 0,
  ai_consent_at INTEGER,
  ai_grounding_hash TEXT,
  ai_accepted_count INTEGER NOT NULL DEFAULT 0,
  ai_dismissed_count INTEGER NOT NULL DEFAULT 0
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
