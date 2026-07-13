/**
 * INSIGHTS-04 — cross-session trends API (ADR-0045).
 * GET /api/teams/:id/insights/trends?window=30d|90d|180d
 */
import { Hono } from 'hono'
import { errorResponse } from '../lib/error-handler'
import { z } from 'zod'
import { authMiddleware, type AuthVariables } from '../middleware/auth'
import { planMiddleware, type PlanVariables } from '../middleware/plan'
import { requireFeature } from '../middleware/feature-gate'
import { readKvJson, writeKvJson, deleteKv } from '../lib/kv'
import { namespacedKey } from '../lib/tenant-namespace'
import { writeEvent } from '../lib/observability'
import {
  INSIGHT_TREND_WINDOWS,
  recomputeTeamInsightRollups,
  type InsightTrendWindow,
} from '../lib/team-insights-recurring'
import {
  getTeamInsightRollup,
  type TeamInsightKind,
} from '../lib/team-insights'
import {
  FacilitatorScorecardPayloadSchema,
  recomputeFacilitatorScorecard,
} from '../lib/team-insights-scorecard'
import { decodeKvJson } from '../lib/boundary-decode'
import type { ParentApp } from './parent-app'
import { buildInsightsExport, insightsExportToCsv } from '../lib/team-insights-export'
import { teamDocumentKey } from '../lib/kv-keys'
import type { Team } from './teams'
import { isTeamMember } from '../lib/authz-helpers'
import type { Env } from '../types'
import { INSIGHTS_SHARED_CACHE_TTL_SECONDS } from '../lib/constants'

type Vars = AuthVariables & PlanVariables

const WindowQuerySchema = z.object({
  window: z.enum(INSIGHT_TREND_WINDOWS).default('30d'),
})

function trendsCacheKey(teamId: string, window: string): string {
  return namespacedKey(teamId, `insights:trends:${window}`)
}


export function mountTeamInsightsRoutes(parent: ParentApp) {
  const app = new Hono<{ Bindings: Env; Variables: Vars }>()
  app.use('*', authMiddleware)
  app.use('*', planMiddleware)

  app.get('/:id/insights/trends', requireFeature('crossSessionInsights'), async (c) => {
    const teamId = c.req.param('id')
    const parsed = WindowQuerySchema.safeParse({ window: c.req.query('window') ?? '30d' })
    if (!parsed.success) {
      return c.json(
        {
          ok: false,
          error: { code: 'invalid_window', message: 'window must be 30d, 90d, or 180d' },
          trace_id: c.get('trace_id'),
        },
        400,
      )
    }
    const window = parsed.data.window as InsightTrendWindow

    const team = await readKvJson<Team>(c.env.TEAMS_KV, teamDocumentKey(teamId))
    if (!team) {
      return c.json(
        { ok: false, error: { code: 'not_found', message: 'Team not found' }, trace_id: c.get('trace_id') },
        404,
      )
    }
    if (!isTeamMember(team, c.get('user').sub)) {
      return c.json(
        { ok: false, error: { code: 'forbidden', message: 'Not a member of this team' }, trace_id: c.get('trace_id') },
        403,
      )
    }

    const kv = c.env.TEAMS_KV
    const cacheKey = trendsCacheKey(teamId, window)
    if (kv) {
      const cached = await readKvJson<{
        window: string
        recurringThemes: unknown
        engagement: unknown
        computedAt: number
        source: string
      }>(kv, cacheKey)
      if (cached) {
        writeEvent(c.env.METRICS_AE, {
          name: 'insight.trends_viewed',
          userId: c.get('user').sub,
          teamId,
          plan: c.get('plan'),
          detail: window,
          traceId: c.get('trace_id'),
        })
        return c.json({ ok: true, data: { ...cached, cached: true }, trace_id: c.get('trace_id') })
      }
    }

    const { recurringThemes, engagement } = await recomputeTeamInsightRollups(
      { AI: c.env.AI, DECISIONS_VECTORIZE: c.env.DECISIONS_VECTORIZE },
      c.env.DB,
      teamId,
      window,
    )

    const computedAt = Date.now()
    const payload = {
      window,
      recurringThemes,
      engagement,
      computedAt,
      source: 'computed',
    }

    if (kv) {
      await writeKvJson(kv, cacheKey, payload, { expirationTtl: INSIGHTS_SHARED_CACHE_TTL_SECONDS })
    }

    writeEvent(c.env.METRICS_AE, {
      name: 'insight.trends_viewed',
      userId: c.get('user').sub,
      teamId,
      plan: c.get('plan'),
      count: recurringThemes.length,
      detail: window,
      traceId: c.get('trace_id'),
    })

    return c.json({ ok: true, data: { ...payload, cached: false }, trace_id: c.get('trace_id') })
  })

  app.get('/:id/insights/scorecard', requireFeature('crossSessionInsights'), async (c) => {
    const teamId = c.req.param('id')
    const parsed = WindowQuerySchema.safeParse({ window: c.req.query('window') ?? '30d' })
    if (!parsed.success) {
      return c.json(
        {
          ok: false,
          error: { code: 'invalid_window', message: 'window must be 30d, 90d, or 180d' },
          trace_id: c.get('trace_id'),
        },
        400,
      )
    }
    const window = parsed.data.window as InsightTrendWindow

    const team = await readKvJson<Team>(c.env.TEAMS_KV, teamDocumentKey(teamId))
    if (!team) {
      return c.json(
        { ok: false, error: { code: 'not_found', message: 'Team not found' }, trace_id: c.get('trace_id') },
        404,
      )
    }
    if (!isTeamMember(team, c.get('user').sub)) {
      return c.json(
        { ok: false, error: { code: 'forbidden', message: 'Not a member of this team' }, trace_id: c.get('trace_id') },
        403,
      )
    }

    const kind: TeamInsightKind = 'facilitator_scorecard'
    let rollup = await getTeamInsightRollup(c.env.DB, teamId, kind, window)
    const stale = !rollup || Date.now() - rollup.computed_at > 86_400_000
    const scorecard = stale
      ? await recomputeFacilitatorScorecard(c.env.DB, teamId, window)
      : (decodeKvJson(rollup!.payload_json, FacilitatorScorecardPayloadSchema) ??
        (await recomputeFacilitatorScorecard(c.env.DB, teamId, window)))

    writeEvent(c.env.METRICS_AE, {
      name: 'insight.scorecard_viewed',
      userId: c.get('user').sub,
      teamId,
      plan: c.get('plan'),
      count: scorecard.facilitators.length,
      detail: window,
      traceId: c.get('trace_id'),
    })

    return c.json({ ok: true, data: { scorecard, cached: !stale }, trace_id: c.get('trace_id') })
  })

  app.get('/:id/insights/export', requireFeature('crossSessionInsights'), async (c) => {
    const teamId = c.req.param('id')
    const format = (c.req.query('format') ?? 'json').toLowerCase()
    const parsed = WindowQuerySchema.safeParse({ window: c.req.query('window') ?? '30d' })
    if (!parsed.success) {
      return c.json(
        { ok: false, error: { code: 'invalid_window', message: 'window must be 30d, 90d, or 180d' }, trace_id: c.get('trace_id') },
        400,
      )
    }
    const window = parsed.data.window as InsightTrendWindow

    const team = await readKvJson<Team>(c.env.TEAMS_KV, teamDocumentKey(teamId))
    if (!team) {
      return errorResponse(c, 404, 'not_found', 'Team not found')
    }
    if (!isTeamMember(team, c.get('user').sub)) {
      return errorResponse(c, 403, 'forbidden', 'Not a member of this team')
    }

    const bundle = await buildInsightsExport(
      { AI: c.env.AI, DECISIONS_VECTORIZE: c.env.DECISIONS_VECTORIZE },
      c.env.DB,
      teamId,
      window,
    )

    writeEvent(c.env.METRICS_AE, {
      name: 'insight.export_viewed',
      userId: c.get('user').sub,
      teamId,
      plan: c.get('plan'),
      detail: format,
      traceId: c.get('trace_id'),
    })

    if (format === 'csv') {
      const csv = insightsExportToCsv(bundle)
      return new Response(csv, {
        status: 200,
        headers: {
          'content-type': 'text/csv; charset=utf-8',
          'content-disposition': `attachment; filename="insights-${teamId}-${window}.csv"`,
        },
      })
    }

    return c.json({ ok: true, data: bundle, trace_id: c.get('trace_id') })
  })

  /** On-demand refresh — recomputes rollups for all standard windows. */
  app.post('/:id/insights/refresh', requireFeature('crossSessionInsights'), async (c) => {
    const teamId = c.req.param('id')
    const team = await readKvJson<Team>(c.env.TEAMS_KV, teamDocumentKey(teamId))
    if (!team) {
      return c.json(
        { ok: false, error: { code: 'not_found', message: 'Team not found' }, trace_id: c.get('trace_id') },
        404,
      )
    }
    if (!isTeamMember(team, c.get('user').sub)) {
      return c.json(
        { ok: false, error: { code: 'forbidden', message: 'Not a member of this team' }, trace_id: c.get('trace_id') },
        403,
      )
    }

    const env = { AI: c.env.AI, DECISIONS_VECTORIZE: c.env.DECISIONS_VECTORIZE }
    for (const window of INSIGHT_TREND_WINDOWS) {
      await recomputeTeamInsightRollups(env, c.env.DB, teamId, window)
      await recomputeFacilitatorScorecard(c.env.DB, teamId, window)
      if (c.env.TEAMS_KV) await deleteKv(c.env.TEAMS_KV, trendsCacheKey(teamId, window))
    }

    return c.json({ ok: true, data: { refreshed: true, windows: [...INSIGHT_TREND_WINDOWS] }, trace_id: c.get('trace_id') })
  })

  parent.route('/api/teams', app)
}
