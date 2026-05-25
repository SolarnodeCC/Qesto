/**
 * Public API v3 — OpenAPI, idempotency, usage metering (API-PLAT-V3-GA-01).
 */
import { Hono } from 'hono'
import { z } from 'zod'
import { publicApiKeyMiddleware, type ApiKeyVars } from '../middleware/public-api-auth'
import { apiKeyHasScope } from '../lib/api-keys'
import { OPENAPI_V3_SPEC } from '../lib/openapi-v3-spec'
import { withIdempotency } from '../lib/idempotency'
import { generateJoinCode } from '../lib/code'
import { ulid } from '../lib/ulid'
import { validateBody } from '../lib/validate'
import { recordApiUsage, getApiUsageForTeam } from '../lib/api-usage'
import { getTeamRegionConfig, resolveWriteBinding } from '../lib/db-router'
import {
  listSessionsForTeam,
  fetchSessionForTeam,
  createDraftSessionForTeam,
} from '../repositories/sessionRepository'
import type { AuthVariables } from '../middleware/auth'
import type { PlanVariables } from '../middleware/plan'
import type { AdminVariables } from '../middleware/admin'
import type { RbacVariables } from '../middleware/rbac'
import type { Env } from '../types'

type PublicApiVars = AuthVariables & PlanVariables & Partial<AdminVariables> & Partial<RbacVariables>

const CreateSessionSchema = z.object({
  title: z.string().min(1).max(200),
})

export function mountPublicApiV3Routes(parent: Hono<{ Bindings: Env; Variables: PublicApiVars }>) {
  const app = new Hono<{ Bindings: Env; Variables: ApiKeyVars }>()
  app.use('*', publicApiKeyMiddleware)

  app.use('*', async (c, next) => {
    const kv = c.env.ACTIONS_KV ?? c.env.INTEGRATIONS_KV
    if (kv) await recordApiUsage(kv, c.get('apiKey').teamId)
    await next()
  })

  app.get('/openapi.json', (c) => c.json(OPENAPI_V3_SPEC))

  app.get('/sessions', async (c) => {
    if (!apiKeyHasScope(c.get('apiKey'), 'read')) {
      return c.json({ ok: false, error: { code: 'forbidden', message: 'read scope required' } }, 403)
    }
    const sessions = await listSessionsForTeam(c.env.DB, c.get('apiKey').teamId)
    return c.json({ ok: true, data: { sessions, apiVersion: 3 } })
  })

  app.post('/sessions', async (c) => {
    if (!apiKeyHasScope(c.get('apiKey'), 'write')) {
      return c.json({ ok: false, error: { code: 'forbidden', message: 'write scope required' } }, 403)
    }
    const parsed = await validateBody(c, CreateSessionSchema)
    if ('error' in parsed) return parsed.error
    const key = c.get('apiKey')
    const idemKey = c.req.header('idempotency-key') ?? undefined
    const kv = c.env.ACTIONS_KV
    const result = await withIdempotency(kv, `apikey:${key.id}`, idemKey, async () => {
      const id = ulid()
      const code = generateJoinCode()
      await createDraftSessionForTeam(c.env.DB, {
        id,
        teamId: key.teamId,
        ownerId: key.createdBy,
        title: parsed.data.title,
        code,
      })
      const session = await fetchSessionForTeam(c.env.DB, id, key.teamId)
      return { status: 201 as const, body: { ok: true as const, data: { session } } }
    })
    return c.json(result.body, result.status as 201, result.replayed ? { 'X-Idempotent-Replayed': 'true' } : {})
  })

  app.get('/sessions/:id/results', async (c) => {
    if (!apiKeyHasScope(c.get('apiKey'), 'read')) {
      return c.json({ ok: false, error: { code: 'forbidden', message: 'read scope required' } }, 403)
    }
    const { teamId } = c.get('apiKey')
    const sessionId = c.req.param('id')
    const session = await fetchSessionForTeam(c.env.DB, sessionId, teamId)
    if (!session) {
      return c.json({ ok: false, error: { code: 'not_found', message: 'Session not found' } }, 404)
    }
    const questions = await c.env.DB.prepare(
      `SELECT id, kind, prompt FROM questions WHERE session_id = ?1 ORDER BY position`,
    )
      .bind(sessionId)
      .all()
    const votes = await c.env.DB.prepare(
      `SELECT question_id, option_id, COUNT(*) as count FROM votes WHERE session_id = ?1 GROUP BY question_id, option_id`,
    )
      .bind(sessionId)
      .all()
    return c.json({
      ok: true,
      data: { session, questions: questions.results ?? [], vote_counts: votes.results ?? [] },
    })
  })

  app.get('/usage', async (c) => {
    const kv = c.env.ACTIONS_KV ?? c.env.INTEGRATIONS_KV
    if (!kv) {
      return c.json({ ok: false, error: { code: 'unavailable', message: 'Usage metering unavailable' } }, 503)
    }
    const usage = await getApiUsageForTeam(kv, c.get('apiKey').teamId)
    return c.json({ ok: true, data: { usage, quota: { requestsPerDay: 50_000 } } })
  })

  app.get('/residency', async (c) => {
    const teamId = c.get('apiKey').teamId
    const config = await getTeamRegionConfig(c.env.TEAMS_KV, teamId)
    const binding = resolveWriteBinding(c.env, config)
    return c.json({
      ok: true,
      data: {
        teamId,
        homeRegion: config.homeRegion,
        regionLock: config.regionLock ?? null,
        writeBinding: binding.binding,
        effectiveRegion: binding.region,
        residencyLocked: binding.residencyLocked,
        proof: {
          checkedAt: Date.now(),
          source: 'kv:team:region',
          multiRegionWritesEnabled: c.env.MULTI_REGION_WRITES_ENABLED === 'true',
        },
      },
    })
  })

  parent.route('/api/v3', app)
}
