-- Qesto — D1 schema (v1 vertical slice)
-- Applied via: `wrangler d1 execute <db> --file=schema.sql`
-- See docs/spec/SPEC_DATAMODEL.md and docs/DATABASE_GOVERNANCE.md.
--
-- v1 scope (Phase 0–5): users, sessions, questions, votes, audit_log, magic_links.
-- Deferred tables (teams, billing, templates, decisions, energizers) ship post-v1.

PRAGMA foreign_keys = ON;

-- ─────────────────────────────────────────────────────────────────────────────
-- users — authenticated hosts (magic-link, password, or OAuth)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,                                         -- ulid
  email TEXT NOT NULL UNIQUE,
  display_name TEXT,
  created_at INTEGER NOT NULL,                                 -- unix ms
  last_login_at INTEGER,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free','starter','team'))
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ─────────────────────────────────────────────────────────────────────────────
-- magic_links — one-time tokens emailed for login
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS magic_links (
  token_hash TEXT PRIMARY KEY,                                 -- sha-256 of raw token
  email TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,                                 -- 15 min TTL
  consumed_at INTEGER,
  requester_ip TEXT
);
CREATE INDEX IF NOT EXISTS idx_magic_links_email_expires ON magic_links(email, expires_at);

-- ─────────────────────────────────────────────────────────────────────────────
-- sessions — session lifecycle state is the source of truth for DRAFT/CLOSED/ARCHIVED
-- LIVE state lives in the SessionRoom Durable Object (see ADR-0001).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,                                         -- ulid
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,                                   -- 6-char join code
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

-- ─────────────────────────────────────────────────────────────────────────────
-- questions — v1 slice supports 'poll' only. Other types reserved for future.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS questions (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,                                   -- 0-indexed order
  kind TEXT NOT NULL CHECK (kind IN ('poll','ranking','consent','open')),
  prompt TEXT NOT NULL,
  options_json TEXT NOT NULL DEFAULT '[]',                     -- JSON array of {id,label}
  created_at INTEGER NOT NULL,
  UNIQUE(session_id, position)
);
CREATE INDEX IF NOT EXISTS idx_questions_session ON questions(session_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- votes — persisted after session close (LIVE state stays in the DO)
-- voter_id = sha256(ip || fingerprint) per PSM-007 (SPEC_REALTIME.md).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS votes (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  voter_id TEXT NOT NULL,
  option_id TEXT NOT NULL,                                     -- references options_json[].id
  submitted_at INTEGER NOT NULL,
  UNIQUE(question_id, voter_id)                                -- one vote per voter per question
);
CREATE INDEX IF NOT EXISTS idx_votes_session ON votes(session_id);
CREATE INDEX IF NOT EXISTS idx_votes_question ON votes(question_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- audit_log — append-only trail for security, GDPR, ops
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  ts INTEGER NOT NULL,
  actor_id TEXT,                                               -- null for anonymous
  actor_ip TEXT,
  action TEXT NOT NULL,                                        -- e.g. 'session.start'
  subject_type TEXT,                                           -- 'session','user',…
  subject_id TEXT,
  meta_json TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_audit_ts ON audit_log(ts);
CREATE INDEX IF NOT EXISTS idx_audit_subject ON audit_log(subject_type, subject_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- user_roles — RBAC role assignments (Phase 8)
-- Roles: owner, admin, member, viewer, guest
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_roles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member', 'viewer', 'guest')),
  created_at INTEGER NOT NULL,
  UNIQUE(user_id, role)
);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role);

-- ─────────────────────────────────────────────────────────────────────────────
-- audit_events — comprehensive audit trail with before/after snapshots (Phase 8)
-- Captures all state mutations with full change tracking for compliance
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  ts INTEGER NOT NULL,                                           -- unix ms
  actor_id TEXT REFERENCES users(id),                            -- who performed the action
  actor_ip TEXT,                                                 -- source IP
  action TEXT NOT NULL,                                          -- e.g. 'session.start', 'user.role_change'
  subject_type TEXT,                                             -- 'session', 'user', 'team'
  subject_id TEXT,                                               -- target resource ID
  before_snapshot TEXT,                                          -- JSON of state before
  after_snapshot TEXT,                                           -- JSON of state after
  trace_id TEXT,                                                 -- request correlation ID
  idempotency_key TEXT,                                          -- deduplication key for retries
  UNIQUE(trace_id, action, subject_id)                           -- prevent duplicate logging
);
CREATE INDEX IF NOT EXISTS idx_audit_events_ts ON audit_events(ts DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_actor ON audit_events(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_subject ON audit_events(subject_type, subject_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_action ON audit_events(action);
