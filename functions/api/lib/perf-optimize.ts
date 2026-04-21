// Performance optimization helpers — Phase 10 Step 1
//
// API latency profiling, batch query patterns, index recommendations

export interface LatencyMetric {
  route: string
  p50_ms: number
  p95_ms: number
  p99_ms: number
  error_rate: number
  request_count: number
}

/**
 * Analyze API latency profile from metrics.
 * Returns routes that exceed p95 budget (200ms).
 */
export function analyzeLatencyProfile(metrics: LatencyMetric[]): Array<{
  route: string
  p95_ms: number
  budget_ms: number
  status: 'pass' | 'warning' | 'critical'
}> {
  const budget = 200
  const critical_threshold = 500

  return metrics
    .map((m) => {
      let status: 'pass' | 'warning' | 'critical' = 'pass'
      if (m.p95_ms > critical_threshold) status = 'critical'
      else if (m.p95_ms > budget) status = 'warning'

      return {
        route: m.route,
        p95_ms: m.p95_ms,
        budget_ms: budget,
        status,
      }
    })
    .filter((r) => r.status !== 'pass')
    .sort((a, b) => b.p95_ms - a.p95_ms)
}

/**
 * Recommend indexes for slow queries.
 * Based on query patterns observed in logs.
 */
export function recommendIndexes(): Array<{ table: string; columns: string[]; reason: string }> {
  return [
    {
      table: 'sessions',
      columns: ['owner_id', 'status', 'created_at'],
      reason: 'List sessions by owner + status (common filter)',
    },
    {
      table: 'questions',
      columns: ['session_id', 'position'],
      reason: 'Get questions ordered by position (DRAFT API)',
    },
    {
      table: 'votes',
      columns: ['session_id', 'question_id'],
      reason: 'Aggregate votes per question (Results page)',
    },
    {
      table: 'leaderboard_entries',
      columns: ['session_id', 'rank'],
      reason: 'Get top N leaderboard entries (live feed)',
    },
    {
      table: 'audit_events',
      columns: ['actor_id', 'ts'],
      reason: 'Query audit by user + date range (audit UI)',
    },
  ]
}

/**
 * Batch query patterns that reduce N+1 problems.
 */
export const batchQueryPatterns = {
  // Instead of: for each session, fetch questions (N+1)
  // Use: fetch all questions WHERE session_id IN (...) in single query
  fetchQuestionsBatch: (sessionIds: string[]) =>
    `SELECT * FROM questions WHERE session_id IN (${sessionIds.map(() => '?').join(',')}) ORDER BY position`,

  // Instead of: for each question, aggregate votes (N+1)
  // Use: aggregate all votes per question in single query
  aggregateVotesBatch: (questionIds: string[]) =>
    `SELECT question_id, option_id, COUNT(*) as count
     FROM votes WHERE question_id IN (${questionIds.map(() => '?').join(',')})
     GROUP BY question_id, option_id`,

  // Instead of: for each session, count participants (N+1)
  // Use: count all participants per session in single query
  countParticipantsBatch: (sessionIds: string[]) =>
    `SELECT session_id, COUNT(DISTINCT voter_id) as participant_count
     FROM votes WHERE session_id IN (${sessionIds.map(() => '?').join(',')})
     GROUP BY session_id`,
}

/**
 * KV caching strategy for hot data.
 * Reduces D1 load on frequently-accessed data.
 */
export const kvCachingStrategy = {
  // Cache plan quotas per team (5 min TTL)
  planUsageKey: (teamId: string) => `cache:plan:${teamId}`,
  planUsageTtl: 5 * 60,

  // Cache team metadata (10 min TTL)
  teamMetadataKey: (teamId: string) => `cache:team:${teamId}`,
  teamMetadataTtl: 10 * 60,

  // Cache user roles (5 min TTL, changes infrequently)
  userRolesKey: (userId: string) => `cache:roles:${userId}`,
  userRolesTtl: 5 * 60,

  // Cache session leaderboard (1 min TTL, updates frequently)
  leaderboardKey: (sessionId: string) => `cache:leaderboard:${sessionId}`,
  leaderboardTtl: 1 * 60,
}

/**
 * Code-split routes for frontend optimization.
 * These routes should be lazy-loaded by Vite.
 */
export const codeSplitRoutes = [
  'Wizard',       // /wizard — heavy AI integration
  'Results',      // /results — complex visualizations
  'Insights',     // /insights — AI analysis, analytics
  'AdminDashboard', // /admin — metrics, admin-only
]

/**
 * Load testing recommendations.
 */
export const loadTestingStrategy = {
  targetScenarios: [
    {
      name: 'Concurrent Sessions',
      participants: 100,
      duration_seconds: 300,
      target_metric: 'API p95 latency < 200ms',
    },
    {
      name: 'WebSocket Connections',
      participants: 1000,
      duration_seconds: 300,
      target_metric: 'DO throughput > 100 updates/sec',
    },
    {
      name: 'Leaderboard Updates',
      participants: 500,
      update_rate_hz: 10,
      duration_seconds: 300,
      target_metric: 'Leaderboard query p95 < 100ms',
    },
  ],
}
