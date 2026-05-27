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

export type Sprint19Baseline = {
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
