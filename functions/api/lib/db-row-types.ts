/**
 * db-row-types.ts
 * Typed row interfaces matching schema.sql for use with D1PreparedStatement
 * generic parameters (.first<T>() / .all<T>()).
 *
 * These replace the scattered `(env.DB.prepare as any)` casts throughout
 * the route layer. See TECH_DEBT_AUDIT_2026-05.md TD-02.
 *
 * Usage:
 *   const row = await c.env.DB.prepare(SQL).bind(id).first<EnergizerRow>()
 *   const { results } = await c.env.DB.prepare(SQL).bind(id).all<EnergizerVoteRow>()
 */

// ─── energizers ──────────────────────────────────────────────────────────────
export interface EnergizerRow {
  id: string
  session_id: string
  kind: string
  prompt: string
  options_json: string
  config_json: string
  position: number
  state: 'draft' | 'active' | 'completed'
  created_at: number
  updated_at: number
}

// ─── energizer_votes ─────────────────────────────────────────────────────────
export interface EnergizerVoteRow {
  id: string
  energizer_id: string
  session_id: string
  voter_id: string
  value: string
  created_at: number
}

export interface EnergizerVoteCountRow {
  value: string
  count: number
}

// ─── team_quiz_responses ─────────────────────────────────────────────────────
export interface TeamQuizResponseRow {
  id: string
  energizer_id: string
  voter_id: string
  question_index: number
  value: string
  correct: number // SQLite stores 0/1
  created_at: number
}

export interface TeamQuizScoreRow {
  voter_id: string
  score: number
}

export interface CountRow {
  n: number
}

// ─── leaderboard_entries ─────────────────────────────────────────────────────
export interface LeaderboardEntryRow {
  id: string
  session_id: string
  user_id: string
  rank: number
  score: number
  accuracy: number | null
  speed_avg_ms: number | null
  badge_count: number | null
  updated_at: number
}

// ─── badges ──────────────────────────────────────────────────────────────────
export interface BadgeRow {
  id: string
  user_id: string
  badge_type: string
  session_id: string | null
  awarded_at: number
}

// ─── sessions ────────────────────────────────────────────────────────────────
export interface SessionRow {
  id: string
  owner_id: string
  code: string
  title: string
  status: 'draft' | 'live' | 'energizing' | 'closed' | 'archived'
  anonymity: 'full' | 'partial' | 'none' | 'zero_knowledge'
  vote_policy: 'once' | 'multi' | 'react'
  session_mode: 'reflection' | 'fun' | 'townhall' | 'stage'
  created_at: number
  started_at: number | null
  closed_at: number | null
  archived_at: number | null
  team_id: string | null
  ai_generated: number
  ai_consent_at: number | null
  ai_grounding_hash: string | null
  ai_accepted_count: number
  ai_dismissed_count: number
  townhall_moderation: 'pre' | 'post' | null
}

// ─── users ───────────────────────────────────────────────────────────────────
export interface UserRow {
  id: string
  email: string
  display_name: string | null
  created_at: number
  last_login_at: number | null
  plan: 'free' | 'starter' | 'team'
  suspended_at: number | null
}

// ─── user_roles ──────────────────────────────────────────────────────────────
export interface UserRoleRow {
  id: string
  user_id: string
  role: 'owner' | 'admin' | 'member' | 'viewer' | 'guest'
  created_at: number
}

// ─── votes ───────────────────────────────────────────────────────────────────
export interface VoteRow {
  id: string
  session_id: string
  question_id: string
  voter_id: string
  option_id: string
  submitted_at: number
}

// ─── questions ───────────────────────────────────────────────────────────────
export interface QuestionRow {
  id: string
  session_id: string
  position: number
  kind: string
  prompt: string
  options_json: string
  created_at: number
}

// ─── audit_events ────────────────────────────────────────────────────────────
export interface AuditEventRow {
  id: string
  ts: number
  actor_id: string | null
  actor_ip: string | null
  action: string
  subject_type: string | null
  subject_id: string | null
  before_snapshot: string | null
  after_snapshot: string | null
  trace_id: string | null
  idempotency_key: string | null
}

// ─── help_documents ──────────────────────────────────────────────────────────
export interface HelpDocumentRow {
  id: string
  title: string
  content: string
  topic: string
  scope: string
  excerpt: string | null
  embedding_id: string | null
  created_at: number
  updated_at: number
  published_at: number | null
}

// ─── custom_roles / team_role_assignments ────────────────────────────────────
export interface CustomRoleRow {
  id: string
  team_id: string
  name: string
  permissions_json: string
  created_by: string
  created_at: number
  updated_at: number
}

export interface TeamRoleAssignmentRow {
  id: string
  team_id: string
  user_id: string
  role_id: string
  assigned_by: string
  assigned_at: number
}
