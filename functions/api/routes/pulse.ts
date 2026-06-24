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
import { buildPulseAuditRecord, recordPulseQueryAudit, fetchPulseQueryAudit, type PulseQueryType } from '../lib/pulse-audit'
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

/**
 * PULSE-AUDIT-01 — log an aggregation read. Best-effort: a write failure must not
 * break the read (the audit table is observability, never the source of truth).
 */
async function recordPulseAudit(
  // hono Context is structurally compatible; keep the call sites terse.
  c: { env: Env; get: (k: 'user' | 'trace_id') => { sub: string } | string | undefined },
  teamId: string,
  queryType: PulseQueryType,
  window: string,
  cohortSize: number,
  maskedRows: number,
): Promise<void> {
  try {
    const user = c.get('user') as { sub: string }
    const traceId = (c.get('trace_id') as string | undefined) ?? null
    const record = buildPulseAuditRecord({
      teamId,
      actorId: user.sub,
      queryType,
      window,
      cohortSize,
      maskedRows,
      traceId,
    })
    await recordPulseQueryAudit(c.env.DB, record)
  } catch {
    /* audit best-effort */
  }
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

    await recordPulseAudit(c, teamId, 'summary', parsed.data.window, maskedSeries.length, maskedSeries.filter((s) => s.masked).length)

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

    await recordPulseAudit(
      c,
      teamId,
      'trends',
      parsed.data.window,
      trends.sessionCount,
      trends.sessions.filter((s) => s.masked).length,
    )

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

  // PULSE-AUDIT-01 — DPO-readable aggregation query audit export (team owner only).
  app.get('/:id/pulse/audit', requireFeature('pulseAnalytics'), async (c) => {
    const teamId = c.req.param('id')
    const team = await readKvJson<Team>(c.env.TEAMS_KV, teamDocumentKey(teamId))
    if (!team) {
      return c.json(
        { ok: false, error: { code: 'not_found', message: 'Team not found' }, trace_id: c.get('trace_id') },
        404,
      )
    }
    // Audit log is a privacy artifact — restrict to the team owner (DPO/admin proxy).
    if (team.ownerId !== c.get('user').sub) {
      return c.json(
        { ok: false, error: { code: 'forbidden', message: 'Only the team owner can read the audit log' }, trace_id: c.get('trace_id') },
        403,
      )
    }

    const records = await fetchPulseQueryAudit(c.env.DB, teamId)
    return c.json({
      ok: true,
      data: { teamId, count: records.length, records },
      trace_id: c.get('trace_id'),
    })
  })

  parent.route('/api/teams', app)
}
