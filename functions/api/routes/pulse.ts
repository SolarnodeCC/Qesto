/**
 * PULSE analytics API (ADR-0057) — GET /api/teams/:id/pulse/summary
 */
import { Hono } from 'hono'
import { z } from 'zod'
import { authMiddleware, type AuthVariables } from '../middleware/auth'
import { planMiddleware, type PlanVariables } from '../middleware/plan'
import { requireFeature } from '../middleware/feature-gate'
import { readKvJson } from '../lib/kv'
import { teamDocumentKey } from '../lib/kv-keys'
import { writeEvent } from '../lib/observability'
import { fetchTeamPulseSummary, PULSE_WINDOWS, fetchTeamLongitudinalTrends, applyKAnonymityToDailyRows } from '../lib/pulse-aggregation'
import type { ParentApp } from './parent-app'
import type { Team } from './teams'
import type { Env } from '../types'

type Vars = AuthVariables & PlanVariables

const WindowQuerySchema = z.object({
  window: z.enum(PULSE_WINDOWS).default('30d'),
})

function isTeamMember(team: Team, userId: string): boolean {
  return team.ownerId === userId || team.members.some((m) => m.userId === userId)
}

export function mountPulseRoutes(parent: ParentApp) {
  const app = new Hono<{ Bindings: Env; Variables: Vars }>()
  app.use('*', authMiddleware)
  app.use('*', planMiddleware)

  app.get('/:id/pulse/summary', requireFeature('pulseAnalytics'), async (c) => {
    const teamId = c.req.param('id')
    const parsed = WindowQuerySchema.safeParse({ window: c.req.query('window') ?? '30d' })
    if (!parsed.success) {
      return c.json(
        {
          ok: false,
          error: { code: 'invalid_window', message: 'window must be 30d or 90d' },
          trace_id: c.get('trace_id'),
        },
        400,
      )
    }

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

    const series = await fetchTeamPulseSummary(c.env.DB, teamId, parsed.data.window)
    const maskedSeries = applyKAnonymityToDailyRows(series)

    writeEvent(c.env.METRICS_AE, {
      name: 'pulse.summary_viewed',
      userId: c.get('user').sub,
      teamId,
      plan: c.get('plan'),
      detail: parsed.data.window,
      traceId: c.get('trace_id'),
    })

    return c.json({
      ok: true,
      data: {
        teamId,
        window: parsed.data.window,
        series: maskedSeries,
        computedAt: maskedSeries.length > 0 ? Math.max(...maskedSeries.map((s) => s.computedAt)) : null,
      },
      trace_id: c.get('trace_id'),
    })
  })

  app.get('/:id/pulse/trends', requireFeature('pulseAnalytics'), async (c) => {
    const teamId = c.req.param('id')
    const parsed = WindowQuerySchema.safeParse({ window: c.req.query('window') ?? '90d' })
    if (!parsed.success) {
      return c.json(
        {
          ok: false,
          error: { code: 'invalid_window', message: 'window must be 30d or 90d' },
          trace_id: c.get('trace_id'),
        },
        400,
      )
    }

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

    const trends = await fetchTeamLongitudinalTrends(c.env.DB, teamId, parsed.data.window)

    writeEvent(c.env.METRICS_AE, {
      name: 'pulse.trends_viewed',
      userId: c.get('user').sub,
      teamId,
      plan: c.get('plan'),
      detail: parsed.data.window,
      count: trends.sessionCount,
      traceId: c.get('trace_id'),
    })

    return c.json({
      ok: true,
      data: trends,
      trace_id: c.get('trace_id'),
    })
  })

  parent.route('/teams', app)
}
