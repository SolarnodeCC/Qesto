-- Phase 8/9: audit_events, badges, leaderboard_entries, referral_codes, referral_signups.
-- These tables were defined in schema.sql but never shipped as migrations, so they
-- don't exist in the database.  badges and leaderboard_entries are actively written
-- by energizers routes (no try/catch), causing 500s until this migration is applied.

CREATE TABLE IF NOT EXISTS audit_events (
  id               TEXT PRIMARY KEY,
  ts               INTEGER NOT NULL,
  actor_id         TEXT REFERENCES users(id),
  actor_ip         TEXT,
  action           TEXT NOT NULL,
  subject_type     TEXT,
  subject_id       TEXT,
  before_snapshot  TEXT,
  after_snapshot   TEXT,
  trace_id         TEXT,
  idempotency_key  TEXT,
  UNIQUE(trace_id, action, subject_id)
);
CREATE INDEX IF NOT EXISTS idx_audit_events_ts       ON audit_events(ts DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_actor    ON audit_events(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_subject  ON audit_events(subject_type, subject_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_action   ON audit_events(action);
CREATE INDEX IF NOT EXISTS idx_audit_events_actor_ts ON audit_events(actor_id, ts DESC);

CREATE TABLE IF NOT EXISTS badges (
  id         TEXT    PRIMARY KEY,
  user_id    TEXT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_type TEXT    NOT NULL CHECK (badge_type IN (
               'first_answer', 'speedster', 'perfect_trivia', 'engagement',
               'leaderboard', 'streak', 'consensus', 'comeback')),
  session_id TEXT    REFERENCES sessions(id) ON DELETE CASCADE,
  awarded_at INTEGER NOT NULL,
  UNIQUE(user_id, badge_type, session_id)
);
CREATE INDEX IF NOT EXISTS idx_badges_user    ON badges(user_id);
CREATE INDEX IF NOT EXISTS idx_badges_session ON badges(session_id);

CREATE TABLE IF NOT EXISTS leaderboard_entries (
  id           TEXT    PRIMARY KEY,
  session_id   TEXT    NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  user_id      TEXT    NOT NULL,
  rank         INTEGER NOT NULL,
  score        INTEGER NOT NULL,
  accuracy     REAL    DEFAULT 0,
  speed_avg_ms INTEGER,
  badge_count  INTEGER DEFAULT 0,
  updated_at   INTEGER NOT NULL,
  UNIQUE(session_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_leaderboard_session ON leaderboard_entries(session_id);
CREATE INDEX IF NOT EXISTS idx_leaderboard_rank    ON leaderboard_entries(session_id, rank);

CREATE TABLE IF NOT EXISTS referral_codes (
  id                 TEXT    PRIMARY KEY,
  creator_id         TEXT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code               TEXT    NOT NULL UNIQUE,
  credit_value_cents INTEGER NOT NULL DEFAULT 1000,
  used_count         INTEGER DEFAULT 0,
  created_at         INTEGER NOT NULL,
  expires_at         INTEGER
);
CREATE INDEX IF NOT EXISTS idx_referral_codes_creator ON referral_codes(creator_id);
CREATE INDEX IF NOT EXISTS idx_referral_codes_code    ON referral_codes(code);

CREATE TABLE IF NOT EXISTS referral_signups (
  id               TEXT    PRIMARY KEY,
  referred_user_id TEXT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referrer_user_id TEXT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referral_code_id TEXT    NOT NULL REFERENCES referral_codes(id) ON DELETE CASCADE,
  credit_applied   INTEGER DEFAULT 0,
  credited_at      INTEGER,
  created_at       INTEGER NOT NULL,
  UNIQUE(referred_user_id, referral_code_id)
);
CREATE INDEX IF NOT EXISTS idx_referral_signups_referred ON referral_signups(referred_user_id);
CREATE INDEX IF NOT EXISTS idx_referral_signups_referrer ON referral_signups(referrer_user_id);
