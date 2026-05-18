// DX-INSIGHTS-01/02 — AI-assisted insights for closed sessions.
//
// GET /api/sessions/:id/insights
//   • Authenticated (session owner only)
//   • Plan-gated to `insightsAI` (Team plan in Qesto's v1 quota table; the
//     feature-gate middleware enforces this)
//   • Returns { themes, trend } where themes come from Workers AI (Mistral)
//     and trend is a simple 7d / 30d new-session counter for the owner.
//   • 5-minute KV cache keyed by (session, ai-model) so repeated calls are
//     cheap and deterministic.

import { Hono } from 'hono'
import { authMiddleware, type AuthVariables } from '../middleware/auth'
import { planMiddleware, type PlanVariables } from '../middleware/plan'
import { requireFeature } from '../middleware/feature-gate'
import {
  InsightsAIError,
  InsightsValidationError,
  extractThemes,
  type InsightTheme,
} from '../lib/ai-insights'
import { sanitizeError } from '../lib/error-handler'
import { rateLimit } from '../lib/rate-limit'
import { validateData, PollOptionArraySchema, CachedInsightsSchema } from '../lib/validators'
import type { Env } from '../types'

type Vars = AuthVariables & PlanVariables

type SessionRow = {
  id: string
  owner_id: string
  title: string
  status: 'draft' | 'live' | 'closed' | 'archived'
  closed_at: number | null
  created_at: number
}

type VoteBreakdown = {
  questionId: string
  prompt: string
  kind: 'poll' | 'ranking' | 'consent' | 'open'
  topLabels: string[]
}

type CachedInsights = {
  themes: InsightTheme[]
  trend: { '7d': number; '30d': number }
  cached_at: number
}

const INSIGHTS_MODEL = '@cf/mistral/mistral-7b-instruct-v0.2'
const CACHE_TTL_SECONDS = 300 // 5 min
// Guard against tight loops that would drain AI quota across many sessions.
const AI_RATE_LIMIT = { max: 10, windowSeconds: 3600, prefix: 'insights-ai' }

function cacheKey(sessionId: string): string {
  return `insights:${INSIGHTS_MODEL}:${sessionId}`
}

async function fetchOwnedSession(
  db: D1Database,
  id: string,
  ownerId: string,
): Promise<SessionRow | null> {
  const row = await db
    .prepare(
      `SELECT id, owner_id, title, status, closed_at, created_at
         FROM sessions
        WHERE id = ?1 AND owner_id = ?2`,
    )
    .bind(id, ownerId)
    .first<SessionRow>()
  return row ?? null
}

async function fetchOpenResponses(
  db: D1Database,
  _sessionId: string,
): Promise<string[]> {
  // v1 schema has no dedicated `responses` table; open-ended responses are
  // captured in the SessionRoom DO and, once closed, persisted into the
  // `votes` table with free-text `option_id` values for `kind='open'`
  // questions. The query below returns any such values — if/when a proper
  // responses table lands, swap this out without touching the handler.
  const { results } = await db
    .prepare(
      `SELECT v.option_id AS text
         FROM votes v
         JOIN questions q ON q.id = v.question_id
        WHERE v.session_id = ?1 AND q.kind = 'open'
        ORDER BY v.submitted_at ASC
        LIMIT 500`,
    )
    .bind(_sessionId)
    .all<{ text: string }>()
  return (results ?? []).map((r) => r.text).filter((s) => s && s.length > 0)
}

async function fetchPollBreakdown(
  db: D1Database,
  sessionId: string,
): Promise<VoteBreakdown[]> {
  const { results: qs } = await db
    .prepare(
      `SELECT id, prompt, kind, options_json
         FROM questions
        WHERE session_id = ?1
        ORDER BY position ASC
        LIMIT 20`,
    )
    .bind(sessionId)
    .all<{ id: string; prompt: string; kind: VoteBreakdown['kind']; options_json: string }>()

  const out: VoteBreakdown[] = []
  for (const q of qs ?? []) {
    if (q.kind !== 'poll' && q.kind !== 'ranking' && q.kind !== 'consent') continue
    const { results: counts } = await db
      .prepare(
        `SELECT option_id, COUNT(*) AS n
           FROM votes
          WHERE question_id = ?1
          GROUP BY option_id
          ORDER BY n DESC
          LIMIT 3`,
      )
      .bind(q.id)
      .all<{ option_id: string; n: number }>()
    const options = validateData(JSON.parse(q.options_json), PollOptionArraySchema) ?? []
    const topLabels: string[] = []
    for (const c of counts ?? []) {
      const match = options.find((o) => o.id === c.option_id)
      topLabels.push(match?.label ?? c.option_id)
    }
    out.push({ questionId: q.id, prompt: q.prompt, kind: q.kind, topLabels })
  }
  return out
}

async function fetchTrend(
  db: D1Database,
  ownerId: string,
): Promise<{ '7d': number; '30d': number }> {
  const now = Date.now()
  const d7 = now - 7 * 24 * 60 * 60 * 1000
  const d30 = now - 30 * 24 * 60 * 60 * 1000
  const [row7, row30] = await Promise.all([
    db
      .prepare(
        `SELECT COUNT(*) AS n FROM sessions
          WHERE owner_id = ?1 AND status IN ('closed','archived') AND closed_at >= ?2`,
      )
      .bind(ownerId, d7)
      .first<{ n: number }>(),
    db
      .prepare(
        `SELECT COUNT(*) AS n FROM sessions
          WHERE owner_id = ?1 AND status IN ('closed','archived') AND closed_at >= ?2`,
      )
      .bind(ownerId, d30)
      .first<{ n: number }>(),
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
      return c.json(
        { ok: false, error: { code: 'not_found', message: 'Session not found' }, trace_id: c.get('trace_id') },
        404,
      )
    }
    if (session.status !== 'closed' && session.status !== 'archived') {
      return c.json(
        {
          ok: false,
          error: { code: 'conflict', message: 'Insights are only available for closed sessions' },
          trace_id: c.get('trace_id'),
        },
        409,
      )
    }

    // Cache check before rate limit — hits don't consume AI quota.
    const cached = await c.env.SESSIONS_KV.get(cacheKey(id), 'json')
    if (cached) {
      const ci = validateData(cached, CachedInsightsSchema)
      if (ci) {
        return c.json({
          ok: true,
          data: {
            themes: ci.themes,
            trend: ci.trend,
            cached: true,
            cached_at: ci.cached_at,
          },
          trace_id: c.get('trace_id'),
        })
      }
    }

    // Rate limit only applies to fresh AI calls.
    const rl = await rateLimit(c.env.ACTIONS_KV, user.sub, AI_RATE_LIMIT)
    if (!rl.allowed) {
      return c.json(
        {
          ok: false,
          error: { code: 'rate_limited', message: 'Too many insights requests; try again later' },
          trace_id: c.get('trace_id'),
        },
        429,
      )
    }

    const [openResponses, pollBreakdown, trend] = await Promise.all([
      fetchOpenResponses(c.env.DB, id),
      fetchPollBreakdown(c.env.DB, id),
      fetchTrend(c.env.DB, user.sub),
    ])

    let themes: InsightTheme[] = []
    try {
      const result = await extractThemes(
        c.env.AI,
        {
          sessionTitle: session.title,
          openResponses,
          pollBreakdown: pollBreakdown.map((pb) => ({ prompt: pb.prompt, topLabels: pb.topLabels })),
        },
        INSIGHTS_MODEL,
      )
      themes = result.themes
    } catch (err) {
      if (err instanceof InsightsValidationError) {
        return c.json(
          {
            ok: false,
            error: {
              code: 'ai_output_invalid',
              message: 'AI returned an output that failed validation',
              details: err.details,
            },
            trace_id: c.get('trace_id'),
          },
          502,
        )
      }
      if (err instanceof InsightsAIError) {
        const sanitized = sanitizeError(err, c.env.ENV, 500)
        return c.json(
          {
            ok: false,
            error: { ...sanitized, code: 'ai_failed' },
            trace_id: c.get('trace_id'),
          },
          500,
        )
      }
      throw err
    }

    const payload: CachedInsights = { themes, trend, cached_at: Date.now() }
    // Best-effort cache; don't fail the request if KV write fails.
    try {
      await c.env.SESSIONS_KV.put(cacheKey(id), JSON.stringify(payload), {
        expirationTtl: CACHE_TTL_SECONDS,
      })
    } catch {
      // swallow — cache is an optimisation, not a correctness requirement
    }

    return c.json({
      ok: true,
      data: { themes, trend, cached: false, cached_at: payload.cached_at },
      trace_id: c.get('trace_id'),
    })
  })

  parent.route('/api/sessions', app)
}
