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
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free','starter','team')),
  suspended_at INTEGER                                         -- unix ms; NULL = active
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_suspended ON users(suspended_at);

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
  anonymity TEXT NOT NULL DEFAULT 'full'
    CHECK (anonymity IN ('full','partial','none')),
  vote_policy TEXT NOT NULL DEFAULT 'once'
    CHECK (vote_policy IN ('once','multi','react')),
  session_mode TEXT NOT NULL DEFAULT 'reflection'
    CHECK (session_mode IN ('reflection','fun')),
  created_at INTEGER NOT NULL,
  started_at INTEGER,
  closed_at INTEGER,
  archived_at INTEGER,
  team_id TEXT DEFAULT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_owner ON sessions(owner_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_code ON sessions(code);
-- Phase 10 Step 2: Compound index for listing sessions by owner + status
CREATE INDEX IF NOT EXISTS idx_sessions_owner_status ON sessions(owner_id, status, created_at DESC);
-- OBS-001: index on team_id for analytics segmentation (sessions per team).
CREATE INDEX IF NOT EXISTS idx_sessions_team ON sessions(team_id);

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
-- Phase 10 Step 2: Compound index for ordered question fetching
CREATE INDEX IF NOT EXISTS idx_questions_session_position ON questions(session_id, position);

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
-- Phase 10 Step 2: Compound index for vote aggregation by question
CREATE INDEX IF NOT EXISTS idx_votes_session_question ON votes(session_id, question_id);

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
-- metrics_summary — 5-min API performance buckets populated by scheduled worker (Phase 8)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS metrics_summary (
  id            TEXT    PRIMARY KEY,
  bucket_ts     INTEGER NOT NULL,
  route         TEXT    NOT NULL,
  p50_ms        INTEGER NOT NULL,
  p95_ms        INTEGER NOT NULL,
  p99_ms        INTEGER NOT NULL,
  error_count   INTEGER NOT NULL,
  request_count INTEGER NOT NULL,
  created_at    INTEGER NOT NULL DEFAULT (CAST(UNIXEPOCH() * 1000 AS INTEGER))
);
CREATE INDEX IF NOT EXISTS idx_metrics_ts       ON metrics_summary(bucket_ts DESC);
CREATE INDEX IF NOT EXISTS idx_metrics_route    ON metrics_summary(route, bucket_ts);
CREATE INDEX IF NOT EXISTS idx_metrics_ts_route ON metrics_summary(bucket_ts DESC, route);

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
-- Phase 10 Step 2: Compound index for audit queries by actor + timestamp
CREATE INDEX IF NOT EXISTS idx_audit_events_actor_ts ON audit_events(actor_id, ts DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- badges — auto-awarded achievement tracking (Phase 9)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS badges (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_type TEXT NOT NULL CHECK (badge_type IN ('first_answer', 'speedster', 'perfect_trivia', 'engagement', 'leaderboard', 'streak', 'consensus', 'comeback')),
  session_id TEXT REFERENCES sessions(id) ON DELETE CASCADE,
  awarded_at INTEGER NOT NULL,
  UNIQUE(user_id, badge_type, session_id)
);
CREATE INDEX IF NOT EXISTS idx_badges_user ON badges(user_id);
CREATE INDEX IF NOT EXISTS idx_badges_session ON badges(session_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- energizers — gamification energizer templates (Phase 9)
-- Supported types: poll, ranking, consent, open, battle_royale, bracket, emoji_poll, quick_finger, team_quiz, word_cloud
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS energizers (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN (
    'poll', 'ranking', 'consent', 'open',
    'battle_royale', 'bracket',
    'emoji_poll', 'quick_finger', 'team_quiz', 'word_cloud'
  )),
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

-- ─────────────────────────────────────────────────────────────────────────────
-- battle_royale_rounds — multi-round elimination energizer state (Phase 9)
-- ─────────────────────────────────────────────────────────────────────────────
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

-- ─────────────────────────────────────────────────────────────────────────────
-- bracket_matches — bracket competition match tracking (Phase 9)
-- ─────────────────────────────────────────────────────────────────────────────
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

-- ─────────────────────────────────────────────────────────────────────────────
-- leaderboard_entries — session leaderboard snapshots (Phase 9)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leaderboard_entries (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  rank INTEGER NOT NULL,
  score INTEGER NOT NULL,
  accuracy REAL DEFAULT 0,
  speed_avg_ms INTEGER,
  badge_count INTEGER DEFAULT 0,
  updated_at INTEGER NOT NULL,
  UNIQUE(session_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_leaderboard_session ON leaderboard_entries(session_id);
CREATE INDEX IF NOT EXISTS idx_leaderboard_rank ON leaderboard_entries(session_id, rank);

-- ─────────────────────────────────────────────────────────────────────────────
-- referral_codes — referral link generation + tracking (Phase 9)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS referral_codes (
  id TEXT PRIMARY KEY,
  creator_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  credit_value_cents INTEGER NOT NULL DEFAULT 1000,
  used_count INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  expires_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_referral_codes_creator ON referral_codes(creator_id);
CREATE INDEX IF NOT EXISTS idx_referral_codes_code ON referral_codes(code);

-- ─────────────────────────────────────────────────────────────────────────────
-- referral_signups — signup attribution to referral codes (Phase 9)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS referral_signups (
  id TEXT PRIMARY KEY,
  referred_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referrer_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referral_code_id TEXT NOT NULL REFERENCES referral_codes(id) ON DELETE CASCADE,
  credit_applied INTEGER DEFAULT 0,
  credited_at INTEGER,
  created_at INTEGER NOT NULL,
  UNIQUE(referred_user_id, referral_code_id)
);
CREATE INDEX IF NOT EXISTS idx_referral_signups_referred ON referral_signups(referred_user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Migration v2: session options (vote_policy, session_mode, anonymity rename)
-- Run on existing DBs after deploying this schema version:
--   wrangler d1 execute <db> --command "ALTER TABLE sessions ADD COLUMN vote_policy TEXT NOT NULL DEFAULT 'once'"
--   wrangler d1 execute <db> --command "ALTER TABLE sessions ADD COLUMN session_mode TEXT NOT NULL DEFAULT 'reflection'"
--   wrangler d1 execute <db> --command "UPDATE sessions SET anonymity = 'full' WHERE anonymity = 'anonymous'"
--   wrangler d1 execute <db> --command "UPDATE sessions SET anonymity = 'none' WHERE anonymity = 'identified'"
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_referral_signups_referrer ON referral_signups(referrer_user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- energizer_votes — per-participant votes for emoji_poll and future energizers
-- ─────────────────────────────────────────────────────────────────────────────
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

-- ─────────────────────────────────────────────────────────────────────────────
-- team_quiz_responses — per-participant, per-question answers for Team Quiz
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS team_quiz_responses (
  id TEXT PRIMARY KEY,
  energizer_id TEXT NOT NULL REFERENCES energizers(id) ON DELETE CASCADE,
  voter_id TEXT NOT NULL,
  question_index INTEGER NOT NULL,
  value TEXT NOT NULL,
  correct INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  UNIQUE(energizer_id, voter_id, question_index)
);
CREATE INDEX IF NOT EXISTS idx_tqr_energizer ON team_quiz_responses(energizer_id);
CREATE INDEX IF NOT EXISTS idx_tqr_voter ON team_quiz_responses(energizer_id, voter_id);
