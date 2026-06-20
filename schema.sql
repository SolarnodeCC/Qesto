-- Qesto — D1 schema (v1 vertical slice)
-- Applied via: `wrangler d1 execute <db> --file=schema.sql`
-- See knowledge-base/specifications/domain/SPEC_DATAMODEL.md and knowledge-base/governance/DATABASE_GOVERNANCE.md.
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
  suspended_at INTEGER,                                        -- unix ms; NULL = active
  stripe_customer_id TEXT                                      -- Stripe customer id ↔ user mapping (#585)
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_suspended ON users(suspended_at);
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer_id ON users(stripe_customer_id);

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
    CHECK (anonymity IN ('full','partial','none','zero_knowledge')),
  vote_policy TEXT NOT NULL DEFAULT 'once'
    CHECK (vote_policy IN ('once','multi','react')),
  session_mode TEXT NOT NULL DEFAULT 'reflection'
    CHECK (session_mode IN ('reflection','fun','townhall','stage','retro','ideate','deliberate')),
  created_at INTEGER NOT NULL,
  started_at INTEGER,
  closed_at INTEGER,
  archived_at INTEGER,
  team_id TEXT DEFAULT NULL,
  workspace_id TEXT,
  workspace_seq INTEGER
);
CREATE INDEX IF NOT EXISTS idx_sessions_owner ON sessions(owner_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_code ON sessions(code);
-- Phase 10 Step 2: Compound index for listing sessions by owner + status
CREATE INDEX IF NOT EXISTS idx_sessions_owner_status ON sessions(owner_id, status, created_at DESC);
-- OBS-001: index on team_id for analytics segmentation (sessions per team).
CREATE INDEX IF NOT EXISTS idx_sessions_team ON sessions(team_id);
CREATE INDEX IF NOT EXISTS idx_sessions_workspace ON sessions(workspace_id, workspace_seq DESC);

-- Sprint 18 prereq: AI provenance + GDPR consent audit trail for wizard generation
ALTER TABLE sessions ADD COLUMN ai_generated INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sessions ADD COLUMN ai_consent_at INTEGER;           -- epoch ms; NULL = no consent given
ALTER TABLE sessions ADD COLUMN ai_grounding_hash TEXT;          -- sha256 of generation prompt context
ALTER TABLE sessions ADD COLUMN ai_accepted_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sessions ADD COLUMN ai_dismissed_count INTEGER NOT NULL DEFAULT 0;

-- TOWNHALL-01 (ADR-0044): per-session moderation mode for townhall Q&A sessions.
-- NULL unless session_mode = 'townhall'. 'pre' = hidden until approved; 'post' = visible immediately.
ALTER TABLE sessions ADD COLUMN townhall_moderation TEXT
  CHECK (townhall_moderation IN ('pre','post'));

-- Sprint 19 journey events — durable measurement for wizard → Launchpad evidence.
CREATE TABLE IF NOT EXISTS sprint19_events (
  id TEXT PRIMARY KEY,
  event_name TEXT NOT NULL CHECK (
    event_name IN (
      'wizard.opened',
      'wizard.completed',
      'ai.suggestions_resolved',
      'launchpad.opened',
      'launchpad.launch_attempt',
      'launchpad.launch_success',
      'launchpad.launch_failed',
      'preflight.checked',
      'preflight.failed'
    )
  ),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id TEXT REFERENCES sessions(id) ON DELETE CASCADE,
  team_id TEXT,
  plan TEXT,
  count INTEGER NOT NULL DEFAULT 0,
  value REAL NOT NULL DEFAULT 0,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  trace_id TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sprint19_events_name_created ON sprint19_events(event_name, created_at);
CREATE INDEX IF NOT EXISTS idx_sprint19_events_session ON sprint19_events(session_id);

-- Sprint 21: custom RBAC foundation.
CREATE TABLE IF NOT EXISTS custom_roles (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL,
  name TEXT NOT NULL,
  permissions_json TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_custom_roles_team ON custom_roles(team_id);

CREATE TABLE IF NOT EXISTS team_role_assignments (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role_id TEXT NOT NULL,
  assigned_by TEXT NOT NULL,
  assigned_at INTEGER NOT NULL,
  UNIQUE(team_id, user_id, role_id)
);
CREATE INDEX IF NOT EXISTS idx_team_role_assignments_user_team ON team_role_assignments(user_id, team_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- questions — v1 slice supports 'poll' only. Other types reserved for future.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS questions (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,                                   -- 0-indexed order
  kind TEXT NOT NULL CHECK (kind IN (
    'poll', 'ranking', 'consent', 'open', 'word_cloud',
    'multi_select', 'likert', 'upvote', 'slider', 'reaction'
  )),
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

-- ─────────────────────────────────────────────────────────────────────────────
-- townhall_questions — TOWNHALL-01 (ADR-0044). Audience-submitted Q&A board.
-- LIVE board state lives in the SessionRoom DO; this table is the persist-on-close
-- archive/export tier and the GDPR-erasure surface. author_hash = opaque voterId
-- (sha256(ip || fingerprint)), never PII — enables targeted per-author erasure.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS townhall_questions (
  id            TEXT PRIMARY KEY,                              -- DO-generated item id
  session_id    TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  body          TEXT NOT NULL,                                 -- question text (erasable)
  display_name  TEXT,                                          -- NULL = anonymous (default)
  author_hash   TEXT NOT NULL,                                 -- opaque voterId, no PII
  status        TEXT NOT NULL
                  CHECK (status IN ('pending','approved','dismissed','answered','grouped')),
  upvotes       INTEGER NOT NULL DEFAULT 0,                    -- final merged count at close
  group_parent  TEXT,                                          -- canonical item id, NULL if not grouped
  was_spotlit   INTEGER NOT NULL DEFAULT 0,                    -- 1 if ever spotlighted
  created_at    INTEGER NOT NULL,                              -- epoch ms
  resolved_at   INTEGER,                                       -- when answered/dismissed
  FOREIGN KEY (group_parent) REFERENCES townhall_questions(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_townhall_q_session ON townhall_questions(session_id, status);
CREATE INDEX IF NOT EXISTS idx_townhall_q_author ON townhall_questions(author_hash);

-- ─────────────────────────────────────────────────────────────────────────────
-- deliberate_ballots — DELIBERATE-RECEIPT-01 (ADR-0049). Append-only commitment
-- ledger for cryptographically-verifiable governance voting (session_mode =
-- 'deliberate'). ANONYMOUS by construction: voter_hash is a salted per-session
-- SHA-256 (no user id), so the ledger survives GDPR account deletion and is
-- unlinkable across sessions. commitment = SHA-256(fingerprint:nonce:choice) is
-- coercion-resistant; commitments form a Merkle tree any observer can re-tally.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS deliberate_ballots (
  id            TEXT PRIMARY KEY,                              -- uuid
  session_id    TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  ballot_nonce  TEXT NOT NULL,                                 -- 128-bit blinding factor (hex)
  commitment    TEXT NOT NULL,                                 -- hex SHA-256 commitment (Merkle leaf)
  choice        TEXT NOT NULL,                                 -- public tally bucket
  voter_hash    TEXT NOT NULL,                                 -- salted anon dedup key, no PII
  leaf_index    INTEGER NOT NULL,                              -- insertion order, 0-based
  created_at    INTEGER NOT NULL,                              -- epoch ms
  UNIQUE(session_id, voter_hash),                              -- one ballot per voter per session
  UNIQUE(session_id, ballot_nonce),                            -- nonce uniqueness (anti-replay)
  UNIQUE(session_id, leaf_index)                               -- stable Merkle leaf order under concurrency
);
CREATE INDEX IF NOT EXISTS idx_deliberate_ballots_session ON deliberate_ballots(session_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- embed_widgets — EMBED-WIDGET-API-01 (ADR-0050). One row per registered
-- embeddable-widget config. `allowed_origins` (JSON array of exact origin
-- strings) is the SINGLE source of truth for both the minted token's `ao` claim
-- and the embed page's frame-ancestors CSP. `created_by` is audit-only and is
-- NEVER copied into the browser-shipped token (no PII in the embed credential).
-- `revoked_at` is the immediate kill-switch overriding a still-unexpired token.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS embed_widgets (
  id              TEXT PRIMARY KEY,                              -- widget config id = token `wid`
  team_id         TEXT NOT NULL,                                 -- tenant binding
  session_id      TEXT NOT NULL,                                 -- embedded session (canonical id)
  session_code    TEXT NOT NULL,                                 -- public join code (token `code` claim)
  allowed_origins TEXT NOT NULL,                                 -- JSON array of exact origin strings
  scope           TEXT NOT NULL DEFAULT 'read'
                    CHECK (scope IN ('read')),                   -- v1: read only
  created_by      TEXT NOT NULL,                                 -- minting host user id (audit only)
  created_at      INTEGER NOT NULL,                              -- epoch ms
  revoked_at      INTEGER                                        -- NULL = active; non-NULL = revoked
);
CREATE INDEX IF NOT EXISTS idx_embed_widgets_team ON embed_widgets(team_id);
CREATE INDEX IF NOT EXISTS idx_embed_widgets_session ON embed_widgets(session_id);

CREATE INDEX IF NOT EXISTS idx_votes_question ON votes(question_id);
-- Phase 10 Step 2: Compound index for vote aggregation by question
CREATE INDEX IF NOT EXISTS idx_votes_session_question ON votes(session_id, question_id);
-- #540: compound index for per-participant vote aggregation at session close
CREATE INDEX IF NOT EXISTS idx_votes_session_voter ON votes(session_id, voter_id);

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
-- insights_daily — Sprint 18 prereq: Pre-computed per-session insight aggregates
-- for DX-INSIGHTS-02 sparkline. Populated by precomputeInsights() on session
-- close. Read by GET /insights/themes.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS insights_daily (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  team_id TEXT,                               -- denormalised from sessions (ADR-0045)
  day TEXT NOT NULL,                          -- ISO-8601 date, e.g. '2026-04-30'
  themes_json TEXT NOT NULL DEFAULT '[]',     -- JSON: InsightTheme[]
  confidence REAL NOT NULL DEFAULT 0.0,       -- 0.0–1.0
  n_votes INTEGER NOT NULL DEFAULT 0,
  embedding_ref INTEGER NOT NULL DEFAULT 0,   -- 1 when Vectorize upsert succeeded
  computed_at INTEGER NOT NULL,               -- epoch ms
  UNIQUE(session_id, day)
);
CREATE INDEX IF NOT EXISTS idx_insights_daily_session ON insights_daily(session_id, day DESC);
CREATE INDEX IF NOT EXISTS idx_insights_daily_team_day ON insights_daily(team_id, day DESC);

-- team_insight_rollup — materialised cross-session aggregates (ADR-0045, Sprint 81)
CREATE TABLE IF NOT EXISTS team_insight_rollup (
  team_id TEXT NOT NULL,
  kind TEXT NOT NULL
    CHECK (kind IN ('recurring_themes', 'engagement_trend', 'facilitator_scorecard')),
  window TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  computed_at INTEGER NOT NULL,
  PRIMARY KEY (team_id, kind, window)
);
CREATE INDEX IF NOT EXISTS idx_team_insight_rollup_computed ON team_insight_rollup(team_id, computed_at DESC);

-- device_tokens — native push registration (ADR-0044, Sprint 81)
CREATE TABLE IF NOT EXISTS device_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  token TEXT NOT NULL,
  app_version TEXT,
  locale TEXT,
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  revoked_at INTEGER
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_device_tokens_user_platform_token
  ON device_tokens(user_id, platform, token)
  WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_device_tokens_user_active ON device_tokens(user_id, revoked_at);

-- partner_payment_accounts — marketplace partner billing (E82, MARKETPLACE-BILLING-SPIKE-02, Sprint 82)
-- One Stripe Connect account per partner team; charges/payouts gating mirrors Stripe state.
CREATE TABLE IF NOT EXISTS partner_payment_accounts (
  team_id TEXT PRIMARY KEY,
  stripe_account_id TEXT,
  account_type TEXT NOT NULL DEFAULT 'express'
    CHECK (account_type IN ('express', 'standard', 'custom')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'onboarding', 'verified', 'restricted', 'disabled')),
  charges_enabled INTEGER NOT NULL DEFAULT 0,
  payouts_enabled INTEGER NOT NULL DEFAULT 0,
  default_payout_currency TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_partner_payment_accounts_account ON partner_payment_accounts(stripe_account_id);

-- marketplace_listings — paid partner catalog (MARKETPLACE-PAID-LISTING-01, Sprint 83)
CREATE TABLE IF NOT EXISTS marketplace_listings (
  id TEXT PRIMARY KEY,
  partner_team_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('plugin', 'template', 'agent')),
  title TEXT NOT NULL,
  description TEXT,
  price_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'eur',
  revenue_share_bps INTEGER NOT NULL DEFAULT 7000,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'review', 'live', 'suspended')),
  visibility TEXT NOT NULL DEFAULT 'private'
    CHECK (visibility IN ('private', 'team', 'public')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  published_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_partner ON marketplace_listings(partner_team_id, status);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_status ON marketplace_listings(status, visibility);

CREATE TABLE IF NOT EXISTS marketplace_purchases (
  id TEXT PRIMARY KEY,
  buyer_team_id TEXT NOT NULL,
  listing_id TEXT NOT NULL REFERENCES marketplace_listings(id),
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL,
  purchased_at INTEGER NOT NULL,
  refunded_at INTEGER
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_marketplace_purchases_team_listing
  ON marketplace_purchases(buyer_team_id, listing_id)
  WHERE refunded_at IS NULL;

-- agent_definitions — agent marketplace registry stub (AGENT-MARKETPLACE-FOUNDATION-01, Sprint 84)
CREATE TABLE IF NOT EXISTS agent_definitions (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  marketplace_listing_id TEXT,
  title TEXT NOT NULL,
  model TEXT NOT NULL DEFAULT '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  tools_json TEXT NOT NULL DEFAULT '[]',
  sandbox_policy_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'review', 'live', 'suspended')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_agent_definitions_owner ON agent_definitions(owner_id, status);

-- workspaces — RETRO / IDEATE / EVENT recurring containers (ADR-0048)
CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('retro', 'ideate', 'event')),
  title TEXT NOT NULL,
  template_json TEXT NOT NULL DEFAULT '{}',
  cadence TEXT CHECK (cadence IS NULL OR cadence IN ('weekly','biweekly','sprint','manual')),
  retention_days INTEGER,
  last_instance_at INTEGER,
  archived_at INTEGER,
  created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_workspaces_team_kind ON workspaces(team_id, kind, updated_at DESC);

-- workspace_trend — materialised longitudinal aggregates per workspace (ADR-0048)
CREATE TABLE IF NOT EXISTS workspace_trend (
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('team_health','participation','recurring_themes')),
  window TEXT NOT NULL CHECK (window IN ('30d','90d','180d')),
  payload_json TEXT NOT NULL,
  computed_at INTEGER NOT NULL,
  PRIMARY KEY (workspace_id, kind, window)
);
CREATE INDEX IF NOT EXISTS idx_workspace_trend_computed ON workspace_trend(workspace_id, computed_at DESC);

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
-- Shipped as migrations/0008 (vote_policy, session_mode columns) and
-- migrations/0009 (anonymity CHECK constraint fix: 'anonymous'→'full',
-- 'identified'→'none'; table recreated because SQLite cannot ALTER constraints).
-- Apply: `wrangler d1 migrations apply qesto-prod`
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
-- help_documents — Knowledge base for RAG retrieval (curated help articles)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS help_documents (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  topic TEXT NOT NULL,                              -- 'getting-started', 'faq', 'billing', 'troubleshooting'
  scope TEXT NOT NULL,                              -- 'free' | 'starter' | 'team' (minimum plan to access)
  excerpt TEXT,
  embedding_id TEXT UNIQUE,                         -- Reference to Vectorize document
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  published_at INTEGER                              -- NULL = draft (not searchable)
);
CREATE INDEX IF NOT EXISTS idx_help_documents_topic ON help_documents(topic);
CREATE INDEX IF NOT EXISTS idx_help_documents_scope ON help_documents(scope);
CREATE INDEX IF NOT EXISTS idx_help_documents_published ON help_documents(published_at);

-- ─────────────────────────────────────────────────────────────────────────────
-- help_conversations — AI help assistant conversation sessions
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS help_conversations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id TEXT REFERENCES sessions(id) ON DELETE SET NULL,
  topic TEXT,                                          -- e.g., 'billing', 'features', 'general'
  plan TEXT NOT NULL,                                  -- user's plan at conversation time
  language TEXT NOT NULL DEFAULT 'en',                 -- ISO 639-1 code
  resolved_by_human INTEGER DEFAULT 0,                -- 1 if escalated and resolved
  created_at INTEGER NOT NULL,
  closed_at INTEGER,
  UNIQUE(user_id, created_at)                         -- prevent rapid duplicates
);
CREATE INDEX IF NOT EXISTS idx_help_conversations_user ON help_conversations(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_help_conversations_status ON help_conversations(closed_at);

-- ─────────────────────────────────────────────────────────────────────────────
-- help_messages — individual messages within a conversation
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS help_messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES help_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  sources_json TEXT,                                   -- JSON array of citation objects {url, title, confidence}
  confidence REAL DEFAULT 0.0,                        -- 0.0–1.0 for assistant responses
  handoff_suggested INTEGER DEFAULT 0,                -- 1 if assistant suggests human escalation
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_help_messages_conversation ON help_messages(conversation_id, created_at);

-- ─────────────────────────────────────────────────────────────────────────────
-- help_feedback — track helpful/unhelpful responses for model tuning
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS help_feedback (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL REFERENCES help_messages(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  helpful INTEGER NOT NULL CHECK (helpful IN (0, 1)),
  comment TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_help_feedback_message ON help_feedback(message_id);
CREATE INDEX IF NOT EXISTS idx_help_feedback_user ON help_feedback(user_id);

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

-- ─────────────────────────────────────────────────────────────────────────────
-- pulse_session_rollup / pulse_team_daily — PULSE analytics (ADR-0057, S91)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pulse_session_rollup (
  session_id TEXT PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE,
  team_id TEXT,
  workspace_id TEXT,
  closed_at INTEGER NOT NULL,
  participant_count INTEGER NOT NULL DEFAULT 0,
  vote_count INTEGER NOT NULL DEFAULT 0,
  participation_rate REAL NOT NULL DEFAULT 0,
  sentiment_score REAL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  computed_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pulse_session_team_closed
  ON pulse_session_rollup(team_id, closed_at DESC);

CREATE TABLE IF NOT EXISTS pulse_team_daily (
  team_id TEXT NOT NULL,
  day TEXT NOT NULL,
  participation_avg REAL NOT NULL DEFAULT 0,
  sentiment_avg REAL,
  session_count INTEGER NOT NULL DEFAULT 0,
  response_total INTEGER NOT NULL DEFAULT 0,
  computed_at INTEGER NOT NULL,
  PRIMARY KEY (team_id, day)
);
CREATE INDEX IF NOT EXISTS idx_pulse_team_daily_day
  ON pulse_team_daily(team_id, day DESC);
