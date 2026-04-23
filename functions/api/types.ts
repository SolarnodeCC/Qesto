// Shared types between functions/ (Hono) and src/ (React).
// Kept minimal for the v1 vertical slice.

export type Env = {
  // Vars
  ENV: 'production' | 'preview' | 'dev' | 'staging'
  /** Pages origin — used for CORS allowed-origin and CSRF check. */
  PAGES_URL: string
  /** Worker's own URL — used for OAuth redirect_uri and email magic-link base. */
  API_URL: string
  CF_ACCESS_AUDIENCE?: string
  CF_ACCESS_CERTS_URL?: string
  COMMIT_SHA?: string
  /** SAML SP entity ID (e.g. `https://app.qesto.io`). Vars, not secret. */
  SAML_SP_ENTITY_ID?: string
  /** SAML Assertion Consumer Service URL (e.g. `https://api.qesto.app/api/auth/saml/callback`). */
  SAML_ACS_URL?: string
  /** Superuser email — bypasses all plan quotas. */
  SUPERUSER_EMAIL?: string
  /** Seed admin email — granted owner/admin in dev/test. */
  SEED_ADMIN_EMAIL?: string
  /** Checkout URL for paid plan upgrades. */
  CHECKOUT_URL?: string

  // Secrets (wrangler pages secret put ...)
  JWT_SECRET: string
  RESEND_API_KEY?: string
  STRIPE_SECRET_KEY?: string
  GOOGLE_CLIENT_ID?: string
  GOOGLE_CLIENT_SECRET?: string
  MICROSOFT_CLIENT_ID?: string
  MICROSOFT_CLIENT_SECRET?: string
  MICROSOFT_TENANT_ID?: string

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
export type Anonymity = 'full' | 'partial' | 'none'
export type VotePolicy = 'once' | 'multi' | 'react'
export type SessionMode = 'reflection' | 'fun'

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
  anonymity: Anonymity
  vote_policy: VotePolicy
  session_mode: SessionMode
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

export type PlanTier = User['plan']

export interface PlanQuotas {
  maxSessionsPerMonth: number
  maxParticipantsPerSession: number
  featuresUnlocked: {
    resultsExport: boolean
    semanticSearch: boolean
    insightsAI: boolean
    customBranding: boolean
    consentMode: boolean
    rankingQuestions: boolean
  }
}

export const PLAN_QUOTAS: Record<PlanTier, PlanQuotas> = {
  free: {
    maxSessionsPerMonth: 5,
    maxParticipantsPerSession: 50,
    featuresUnlocked: {
      resultsExport: false,
      semanticSearch: false,
      insightsAI: false,
      customBranding: false,
      consentMode: false,
      rankingQuestions: false,
    },
  },
  starter: {
    maxSessionsPerMonth: 50,
    maxParticipantsPerSession: 500,
    featuresUnlocked: {
      resultsExport: true,
      semanticSearch: true,
      insightsAI: false,
      customBranding: true,
      consentMode: true,
      rankingQuestions: true,
    },
  },
  team: {
    maxSessionsPerMonth: 500, // effectively unlimited
    maxParticipantsPerSession: 5000,
    featuresUnlocked: {
      resultsExport: true,
      semanticSearch: true,
      insightsAI: true,
      customBranding: true,
      consentMode: true,
      rankingQuestions: true,
    },
  },
}

// Standard response envelopes (SPEC_BACKEND.md).
export type ApiSuccess<T> = { ok: true; data: T; trace_id: string }
export type ApiError = {
  ok: false
  error: { code: string; message: string; details?: unknown }
  trace_id: string
}
