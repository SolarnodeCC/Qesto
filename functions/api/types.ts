// Shared types between functions/ (Hono) and src/ (React).
// Kept minimal for the v1 vertical slice.

export type Env = {
  // Vars
  ENV: 'production' | 'preview' | 'dev' | 'staging'
  APP_URL: string
  CF_ACCESS_AUDIENCE?: string
  CF_ACCESS_CERTS_URL?: string
  COMMIT_SHA?: string

  // Secrets (wrangler pages secret put ...)
  JWT_SECRET: string
  RESEND_API_KEY?: string

  // Bindings
  DB: D1Database
  USERS_KV: KVNamespace
  SESSIONS_KV: KVNamespace
  TEAMS_KV: KVNamespace
  TEMPLATES_KV: KVNamespace
  DECISIONS_KV: KVNamespace
  AUDIT_KV: KVNamespace
  ACTIONS_KV: KVNamespace
  SESSION_ROOM: DurableObjectNamespace
  AI: Ai
}

export type SessionStatus = 'draft' | 'live' | 'closed' | 'archived'
export type QuestionKind = 'poll' | 'ranking' | 'consent' | 'open'

export type PollOption = { id: string; label: string }

export type Question = {
  id: string
  session_id: string
  position: number
  kind: QuestionKind
  prompt: string
  options: PollOption[]
  created_at: number
}

export type Session = {
  id: string
  owner_id: string
  code: string
  title: string
  status: SessionStatus
  anonymity: 'anonymous' | 'identified'
  created_at: number
  started_at: number | null
  closed_at: number | null
  archived_at: number | null
}

export type User = {
  id: string
  email: string
  display_name: string | null
  plan: 'free' | 'starter' | 'team'
}

// Standard response envelopes (SPEC_BACKEND.md).
export type ApiSuccess<T> = { ok: true; data: T; trace_id: string }
export type ApiError = {
  ok: false
  error: { code: string; message: string; details?: unknown }
  trace_id: string
}
