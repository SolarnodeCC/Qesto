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
  /** Injected automatically by Cloudflare Pages at deploy time. */
  CF_PAGES_COMMIT_SHA?: string
  /** SAML SP entity ID (e.g. `https://qesto.cc`). Vars, not secret. */
  SAML_SP_ENTITY_ID?: string
  /** SAML Assertion Consumer Service URL (e.g. `https://api.qesto.cc/api/auth/saml/callback`). */
  SAML_ACS_URL?: string
  /** Superuser email — bypasses all plan quotas. */
  SUPERUSER_EMAIL?: string
  /** Seed admin email — granted owner/admin in dev/test. */
  SEED_ADMIN_EMAIL?: string
  /** Checkout URL for paid plan upgrades. */
  CHECKOUT_URL?: string
  /** Public Stripe price IDs; safe to expose for checkout/price reconciliation. */
  STRIPE_STARTER_MONTHLY_PRICE_ID?: string
  STRIPE_STARTER_ANNUAL_PRICE_ID?: string
  STRIPE_TEAM_ANNUAL_PRICE_ID?: string
  /** Display prices in euro cents, used by public plan catalog when set. */
  STARTER_MONTHLY_EUR_CENTS?: string
  STARTER_ANNUAL_EUR_CENTS?: string
  TEAM_ANNUAL_EUR_CENTS?: string
  /** Optional sender shown in Resend, e.g. "Qesto <login@yourdomain.com>". */
  RESEND_FROM?: string
  /** Sprint 25 guard: enables versioned LIVE energizer WebSocket broadcasts. */
  LIVE_ENERGIZERS_ENABLED?: string
  /** v2.2: Circuit breaker for external dependencies (Stripe, Resend, Workers AI). */
  CIRCUIT_BREAKER_ENABLED?: string
  /** v2.2: Integration webhooks (Slack, Notion, Airtable). */
  INTEGRATION_ENABLED?: string
  /** AI-SENTIMENT-01: enable aggregate mood signals in LIVE sessions. */
  SENTIMENT_ENABLED?: string
  /** SEC-RATELIMIT-01: return 503 when ACTIONS_KV rate limiter fails. */
  RATE_LIMIT_FAIL_CLOSED?: string
  /** SEC-WS-CAP-01: max WebSocket connects per IP per minute (default 15). */
  WS_CONNECT_PER_IP_PER_MIN?: string
  /** GROWTH-ENGINE: IndexNow API key for SEO indexing (optional). */
  INDEXNOW_KEY?: string
  /** ADR-0022: multi-region read replica routing (S46+). */
  MULTI_REGION_ENABLED?: string
  MULTI_REGION_PRIMARY?: string
  MULTI_REGION_REPLICAS?: string
  /** ADR-0022 / S51: multi-region failover and state KV. */
  MULTI_REGION_FAILOVER_ENABLED?: string
  /** REALTIME-V2: enable Realtime V2 protocol negotiation. */
  REALTIME_V2_ENABLED?: string
  /** REALTIME-V2: default protocol version when client doesn't specify. */
  REALTIME_V2_DEFAULT?: string
  /** REALTIME-V3: enable protocol v3 (results_delta) negotiation (S79). */
  REALTIME_V3_ENABLED?: string
  /** TOWNHALL (ADR-0044): enable the moderated anonymous Q&A board message family. */
  REALTIME_TOWNHALL_ENABLED?: string
  /** SCIM API bearer token for identity provider integration. */
  SCIM_BEARER_TOKEN?: string
  /** JOIN-CAPTCHA: enable reCAPTCHA verification on session join. */
  JOIN_CAPTCHA_ENABLED?: string
  /** PWA-PUSH-HARDENING-01: VAPID public key (safe to expose to clients). */
  VAPID_PUBLIC_KEY?: string

  // Secrets (wrangler pages secret put ... / wrangler versions secret put ...)
  JWT_SECRET: string
  /** SEC-JWT-ROTATE-01: previous signing secret during rotation window. */
  JWT_SECRET_PREV?: string
  MULTI_REGION_WRITES_ENABLED?: string
  KB_ADMIN_KEY?: string
  RESEND_API_KEY?: string
  STRIPE_SECRET_KEY?: string
  GOOGLE_CLIENT_ID?: string
  GOOGLE_CLIENT_SECRET?: string
  MICROSOFT_CLIENT_ID?: string
  MICROSOFT_CLIENT_SECRET?: string
  MICROSOFT_TENANT_ID?: string
  /** SLACK-01: Slack OAuth2 app credentials (set via `wrangler pages secret put`). */
  SLACK_CLIENT_ID?: string
  SLACK_CLIENT_SECRET?: string
  /** ZOOM-01: Zoom OAuth app (Sprint 35 skeleton). */
  ZOOM_CLIENT_ID?: string
  ZOOM_CLIENT_SECRET?: string
  SALESFORCE_CLIENT_ID?: string
  SALESFORCE_CLIENT_SECRET?: string
  NOTION_CLIENT_ID?: string
  NOTION_CLIENT_SECRET?: string
  LDAP_URL?: string
  LDAP_BIND_DN?: string
  LDAP_BIND_PASSWORD?: string
  /** S52: LDAP bridge integration. */
  LDAP_BRIDGE_URL?: string
  LDAP_TEAM_ID?: string
  LDAP_SYNC_MOCK?: string
  /** GROWTH-ENGINE: HMAC secret for internal marketing webhook trigger. */
  MARKETING_WEBHOOK_SECRET?: string
  /** INT-PROVIDER-01: AES-GCM master key for integration OAuth tokens at rest. */
  OAUTH_TOKEN_MEK?: string
  /** PWA push — VAPID private key (wrangler secret). */
  VAPID_PRIVATE_KEY?: string

  // Bindings
  DB: D1Database
  USERS_KV: KVNamespace
  SESSIONS_KV: KVNamespace
  TEAMS_KV: KVNamespace
  TEMPLATES_KV: KVNamespace
  DECISIONS_KV: KVNamespace
  AUDIT_KV: KVNamespace
  ACTIONS_KV: KVNamespace
  HELP_CONVERSATIONS_KV?: KVNamespace
  MARKETING_KV?: KVNamespace
  SESSION_ROOM: DurableObjectNamespace
  AI: Ai
  WORKFLOWS?: { create: (config: any) => Promise<{ id: string }> }
  DECISIONS_VECTORIZE: VectorizeIndex
  HELP_VECTORIZE: VectorizeIndex
  KB_VECTORIZE: VectorizeIndex
  METRICS_KV?: KVNamespace
  METRICS_AE?: AnalyticsEngineDataset
  CIRCUIT_BREAKER_KV?: KVNamespace
  INTEGRATIONS_KV?: KVNamespace
  /** ADR-0022 / S51: multi-region state and DO cross-region mirror. */
  MULTI_REGION_STATE_KV?: KVNamespace
}

export type SessionStatus = 'draft' | 'energizing' | 'live' | 'closed' | 'archived'
export type QuestionKind =
  | 'poll'
  | 'ranking'
  | 'consent'
  | 'open'
  | 'multi_select'
  | 'likert'
  | 'upvote'
  | 'word_cloud'
  | 'slider'
export type Anonymity = 'full' | 'partial' | 'none' | 'zero_knowledge'
export type VotePolicy = 'once' | 'multi' | 'react'
export type SessionMode = 'reflection' | 'fun' | 'townhall'

/** TOWNHALL (ADR-0044): per-session moderation model, chosen at draft. */
export type TownhallModeration = 'pre' | 'post'
/** TOWNHALL item lifecycle. `spotlight` is a separate O(1) pointer, not a status. */
export type TownhallItemStatus = 'pending' | 'approved' | 'dismissed' | 'answered' | 'grouped'

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
  /** Optional analytics-only field (OBS-001). Not exposed to frontend. */
  team_id?: string | null
  /** Growth Engine: opt-out flag for public template gallery (defaults 1/true). */
  is_public?: number
  /** Sprint 18 prereq: wizard provenance — 1 if questions came from the AI wizard. */
  ai_generated?: number
  /** Sprint 18 prereq: GDPR consent timestamp (epoch ms). NULL if no consent given. */
  ai_consent_at?: number | null
  /** Sprint 18 prereq: sha256 hex of grounding prompt context, used to dedupe refines. */
  ai_grounding_hash?: string | null
  /** S19-MEASURE-01: count of AI-suggested questions the host accepted (kept in final set). */
  ai_accepted_count?: number
  /** S19-MEASURE-01: count of AI-suggested questions the host dismissed. */
  ai_dismissed_count?: number
  /** AI-RECAP-PROV-01: model id used for last recap/insights generation. */
  ai_recap_model?: string | null
  /** AI-RECAP-PROV-01: epoch ms when host edited AI-generated recap text. */
  ai_recap_edited_at?: number | null
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
    samlSso: boolean
    /** TOWNHALL (ADR-0044): moderated anonymous Q&A sessions — Team tier only. */
    townhallQA: boolean
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
      samlSso: false,
      townhallQA: false,
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
      samlSso: false,
      townhallQA: false,
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
      samlSso: true,
      townhallQA: true,
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
