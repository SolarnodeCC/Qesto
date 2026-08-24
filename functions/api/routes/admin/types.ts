import type { EnergizerKindMetric } from '../../lib/admin-engagement-summary'

export type AdminUser = {
  id: string
  email: string
  display_name: string | null
  plan: 'free' | 'starter' | 'team'
  created_at: number
  last_login_at: number | null
  suspended_at: number | null
  admin_role: 'owner' | 'admin' | null
}

export type PlatformKpis = {
  live_sessions: number
  total_users: number
  sessions_today: number
  sessions_this_month: number
  total_sessions: number
  ai_cost_estimate_cents: number
}

export type ServiceStatus = 'healthy' | 'degraded' | 'down'

// ─────────────────────────────────────────────────────────────────────────────
// Platformbeheer — Module 1 (Dashboard): single "is alles oké?" overview.
// Assembled server-side, KV-cached (TTL ~45s) so a dashboard load never fans
// out N+1 queries against D1. See routes/admin/platform-overview.ts.
// ─────────────────────────────────────────────────────────────────────────────

/** Health of one platform component, shown as a status card. */
export type ComponentHealth = {
  status: ServiceStatus
  /** Short human-readable detail (e.g. latency, headroom). Never a secret. */
  detail: string | null
  /** Primary numeric metric for the card, when one applies. */
  metric: number | null
  /** Unit for {@link metric} (e.g. 'ms', '%', 'instances'). */
  unit: string | null
  /** True when the value is a placeholder because the real source was unavailable. */
  synthetic?: boolean
}

/** One open alert/incident, surfaced on the dashboard sorted by severity. */
export type PlatformAlert = {
  id: string
  /** 1 = highest (SEV1) … 3 = lowest. Lower sorts first. */
  severity: 1 | 2 | 3
  title: string
  /** Origin: 'incident' (OPS module) or 'health' (synthesised from a degraded probe). */
  source: 'incident' | 'health'
  created_at: number
}

export type PlatformOverview = {
  generated_at: number
  /** True when this payload was served from the KV cache rather than freshly built. */
  cached: boolean
  /** Status cards per system component. */
  components: {
    workers: ComponentHealth
    d1: ComponentHealth
    durable_objects: ComponentHealth
    workers_ai: ComponentHealth
    vectorize: ComponentHealth
  }
  /** "Live nu" widget. */
  live_now: {
    active_sessions: number
    total_participants: number
    ws_connections: number
    synthetic: boolean
  }
  /** Business snapshot. Revenue beyond 24h is an estimate (see is_estimate). */
  business: {
    signups_today: number
    active_subscriptions: number
    total_users: number
    revenue: {
      window_24h_cents: number
      window_7d_cents: number
      window_30d_cents: number
    }
    /** True when 7d/30d revenue is a run-rate estimate, not settled Stripe data. */
    is_estimate: boolean
  }
  /** Open alerts/incidents, highest severity first. */
  alerts: PlatformAlert[]
  /** Any data source that failed to load — drives the visible "degraded" state. */
  degraded_sources: string[]
}

export type HourlyCorrelation = {
  hour: string
  energizer_activations: number
  energizer_answers: number
  ws_reconnects: number
  ws_errors: number
  ws_capacity_exceeded: number
}

export type OpsSummary = {
  status: ServiceStatus
  sev1: number
  sev2: number
  sev3: number
  impact_sessions: number
  impact_users: number
  services: {
    d1: ServiceStatus
    sessions_kv: ServiceStatus
    workers_ai: ServiceStatus
    session_rooms: ServiceStatus
  }
  realtime: {
    ws_error_rate: number
    reconnect_rate: number
    vote_p95_ms: number | null
  }
  issues: Array<{ action: string; count: number }>
  correlation?: HourlyCorrelation[]
  updated_at: number
}

export type DailyBucket = {
  day: string
  count: number
}

export type AnalyticsData = {
  sessions_today: number
  sessions_this_month: number
  decisions_today: number
  decisions_this_month: number
  sessions_per_day: DailyBucket[]
  decisions_per_day: DailyBucket[]
  session_status: { draft: number; live: number; closed: number; archived: number }
  consent_rate: number
  avg_participants: number
  ai_cost_estimate_cents: number
  total_sessions_created: number
  total_decisions_processed: number
  engagement: {
    energizer_activations: number
    energizer_participants: number
    energizer_completions: number
    energizer_dropouts: number
    leaderboard_participants: number
    badges_awarded: number
    ws_error_rate: number
    reconnect_rate: number
  }
  badge_breakdown: Array<{ kind: string; count: number }>
}

export type JourneyEventBaseline = {
  generated_at: number
  window: { start: number | null; end: number }
  ai_usage_rate: number | null
  wizard_completion_rate: number | null
  launchpad_success_rate: number | null
  inline_suggestion_acceptance_rate: number | null
  invalid_live_attempts: number | null
  preflight_failure_rate: number | null
  counts: {
    total_sessions: number
    ai_generated_sessions: number
    ai_consent_sessions: number
    ai_grounding_sessions: number
    started_or_closed_sessions: number
    draft_sessions: number
    wizard_opened: number
    wizard_completed: number
    ai_suggestions_accepted: number
    ai_suggestions_dismissed: number
    launchpad_opened: number
    launch_attempts: number
    launch_successes: number
    launch_failures: number
    preflight_checks: number
    preflight_failures: number
  }
  measurement_gaps: string[]
}

export type EngagementSummary = {
  from_ms: number
  to_ms: number
  totals: {
    sessions: number
    active_energizers: number
    energizer_activations: number
    energizer_participants: number
    energizer_completions: number
    energizer_dropouts: number
    leaderboard_participants: number
    badges_awarded: number
  }
  energizer_kinds: EnergizerKindMetric[]
}

