// DX-INSIGHTS-01/02 — AI-assisted insights for closed sessions (read side).
//
// GET /api/sessions/:id/insights
//   • Authenticated (session owner only), plan-gated to `insightsAI`.
//   • READ-ONLY: returns the payload produced by
//     POST /api/sessions/:id/insights/analyze (routes/ai-insights/register-analyze.ts),
//     plus a 7d / 30d closed-session trend for the owner.
//   • Never runs Workers AI. A GET used to generate themes on a cache miss; the
//     Dashboard fans this GET out over up to 20 sessions, which burned the user's
//     AI rate limit and monthly free-access quota just by opening the dashboard.
//
// Response shape (stable, consumed by src/hooks/useInsights.ts and
// src/components/insights/SimilarSessionsResultsPanel.tsx):
//   { session_id, themes: string[], follow_ups, generated_at, model, trend,
//     similar_sessions, cached: true }                       — analyzed
//   { session_id, insights: null, themes: [], follow_ups: [], trend,
//     similar_sessions: [], message }                          — not analyzed yet
//
// This route is mounted before routes/ai-insights and therefore shadows its GET.

import { Hono } from 'hono'
import { authMiddleware, type AuthVariables } from '../middleware/auth'
import { planMiddleware, type PlanVariables } from '../middleware/plan'
import { requireFeature } from '../middleware/feature-gate'
import { checkInsightsAllowed } from '../lib/insights-guards'
import { errorResponse } from '../lib/error-handler'
import { readKvJson } from '../lib/kv'
import { logBestEffort } from '../lib/log'
import { insightsCacheKey } from './ai-insights/constants'
import type { Anonymity, Env } from '../types'

type Vars = AuthVariables & PlanVariables

type SessionRow = {
  id: string
  owner_id: string
  title: string
  status: 'draft' | 'live' | 'closed' | 'archived'
  closed_at: number | null
  created_at: number
  anonymity: Anonymity
  ai_generated: number | null
  ai_consent_at: number | null
}

type SimilarSession = { title: string; score: number }

/** The analyze payload as written to DECISIONS_KV, normalised defensively. */
export type InsightsReadPayload = {
  session_id: string
  themes: string[]
  follow_ups: string[]
  generated_at: number
  model: string
  similar_sessions: SimilarSession[]
}

async function fetchOwnedSession(db: D1Database, id: string, ownerId: string): Promise<SessionRow | null> {
  const row = await db
    .prepare(
      `SELECT id, owner_id, title, status, closed_at, created_at,
              anonymity, ai_generated, ai_consent_at
         FROM sessions
        WHERE id = ?1 AND owner_id = ?2`,
    )
    .bind(id, ownerId)
    .first<SessionRow>()
  return row ?? null
}

function isSimilar(s: unknown): s is SimilarSession {
  return (
    !!s &&
    typeof s === 'object' &&
    typeof (s as { title?: unknown }).title === 'string' &&
    typeof (s as { score?: unknown }).score === 'number'
  )
}

/**
 * Normalise a cached analyze payload. Themes may be plain strings (current
 * analyze route) or `{ theme }` objects (older cache entries) — both become
 * strings so the client never has to guess. Returns null when there is no
 * usable payload.
 */
export function normaliseInsightsPayload(sessionId: string, raw: unknown): InsightsReadPayload | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (!Array.isArray(r.themes)) return null
  const themes = r.themes
    .map((t) => (typeof t === 'string' ? t : t && typeof t === 'object' ? (t as { theme?: unknown }).theme : null))
    .filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
  return {
    session_id: sessionId,
    themes,
    follow_ups: Array.isArray(r.follow_ups) ? r.follow_ups.filter((f): f is string => typeof f === 'string') : [],
    generated_at: typeof r.generated_at === 'number' ? r.generated_at : 0,
    model: typeof r.model === 'string' ? r.model : '',
    similar_sessions: Array.isArray(r.similar_sessions) ? r.similar_sessions.filter(isSimilar) : [],
  }
}

async function fetchTrend(db: D1Database, ownerId: string): Promise<{ '7d': number; '30d': number }> {
  const now = Date.now()
  const d7 = now - 7 * 24 * 60 * 60 * 1000
  const d30 = now - 30 * 24 * 60 * 60 * 1000
  const stmt = `SELECT COUNT(*) AS n FROM sessions
                 WHERE owner_id = ?1 AND status IN ('closed','archived') AND closed_at >= ?2`
  const [row7, row30] = await Promise.all([
    db.prepare(stmt).bind(ownerId, d7).first<{ n: number }>(),
    db.prepare(stmt).bind(ownerId, d30).first<{ n: number }>(),
  ])
  return { '7d': row7?.n ?? 0, '30d': row30?.n ?? 0 }
}

export function mountInsightsRoutes(parent: Hono<{ Bindings: Env; Variables: Vars }>) {
  const app = new Hono<{ Bindings: Env; Variables: Vars }>()

  app.use('*', authMiddleware)
  app.use('*', planMiddleware)

  // Feature-gated: Team plan only (see PLAN_QUOTAS.featuresUnlocked.insightsAI).
  app.get('/:id/insights', requireFeature('insightsAI'), async (c) => {
    const user = c.get('user')
    const id = c.req.param('id')

    const session = await fetchOwnedSession(c.env.DB, id, user.sub)
    if (!session) {
      return errorResponse(c, 404, 'not_found', 'Session not found')
    }
    if (session.status !== 'closed' && session.status !== 'archived') {
      return errorResponse(c, 409, 'conflict', 'Insights are only available for closed sessions')
    }

    // REV-06: ZK sessions never reach AI; AI-generated sessions need consent.
    const guard = checkInsightsAllowed(session)
    if (!guard.allowed) {
      return errorResponse(c, 403, guard.code, guard.message)
    }

    let cached: unknown = null
    try {
      cached = c.env.DECISIONS_KV ? await readKvJson<unknown>(c.env.DECISIONS_KV, insightsCacheKey(id)) : null
    } catch (err) {
      logBestEffort(err, {
        traceId: c.get('trace_id') ?? 'unknown',
        route: 'insights.get',
        operation: 'kv.read',
        errorClass: err instanceof Error ? err.name : 'KvReadError',
        reason: 'insights_cache_read_failed',
      })
    }

    const trend = await fetchTrend(c.env.DB, user.sub)
    const payload = normaliseInsightsPayload(id, cached)
    if (!payload) {
      return c.json({
        ok: true,
        data: {
          session_id: id,
          insights: null,
          themes: [],
          follow_ups: [],
          trend,
          similar_sessions: [],
          message: 'No insights generated yet. Call POST /api/sessions/:id/insights/analyze first.',
        },
        trace_id: c.get('trace_id'),
      })
    }

    return c.json({
      ok: true,
      data: { ...payload, trend, cached: true },
      trace_id: c.get('trace_id'),
    })
  })

  parent.route('/api/sessions', app)
}
