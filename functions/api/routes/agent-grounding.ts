/**
 * KB-RAG-01 — decision memory grounding for agents.
 */
import { Hono } from 'hono'
import { errorResponse } from '../lib/error-handler'
import { authMiddleware, type AuthVariables } from '../middleware/auth'
import type { PlanVariables } from '../middleware/plan'
import type { AdminVariables } from '../middleware/admin'
import type { RbacVariables } from '../middleware/rbac'
import { queryDecisionGrounding } from '../lib/agent-grounding'
import { writeEvent } from '../lib/observability'
import { readKvJson } from '../lib/kv'
import { teamDocumentKey } from '../lib/kv-keys'
import { isTeamMember } from '../lib/authz-helpers'
import type { Env } from '../types'
import type { Team } from './teams'

// Match the Vars shape used in app.ts so this sub-router composes cleanly.
type Vars = AuthVariables & PlanVariables & Partial<AdminVariables> & Partial<RbacVariables>

export function mountAgentGroundingRoutes(parent: Hono<{ Bindings: Env; Variables: Vars }>) {
  const app = new Hono<{ Bindings: Env; Variables: Vars }>()
  app.use('*', authMiddleware)

  // DECISIONS_VECTORIZE is cross-tenant, so `teamId` is mandatory and the
  // caller's membership is verified here, before the index is touched
  // (audit #4 — same gate as /studio/authoring/suggest).
  app.get('/grounding', async (c) => {
    const q = c.req.query('q') ?? ''
    if (q.trim().length < 3) {
      return errorResponse(c, 400, 'bad_query', 'Query must be at least 3 characters')
    }
    const teamId = c.req.query('teamId') ?? ''
    if (!teamId) {
      return errorResponse(c, 400, 'team_required', 'teamId query parameter is required')
    }
    const user = c.get('user')
    const team = await readKvJson<Team>(c.env.TEAMS_KV, teamDocumentKey(teamId))
    if (!team || !isTeamMember(team, user.sub)) {
      return errorResponse(c, 403, 'forbidden', 'Not a member of this team')
    }
    writeEvent(c.env.METRICS_AE, { name: 'kb_rag.query', userId: user.sub, detail: q.slice(0, 80) })
    const chunks = await queryDecisionGrounding(c.env, q, 8, teamId)
    writeEvent(c.env.METRICS_AE, {
      name: 'kb_rag.result_returned',
      userId: user.sub,
      count: chunks.length,
    })
    return c.json({ ok: true, data: { chunks }, trace_id: c.get('trace_id') })
  })

  parent.route('/api/agent', app)
}
