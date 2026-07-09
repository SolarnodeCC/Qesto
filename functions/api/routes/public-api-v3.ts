/**
 * Public API v3 — OpenAPI, idempotency, usage metering (API-PLAT-V3-GA-01).
 */
import { Hono } from 'hono'
import { z } from 'zod'
import { publicApiKeyMiddleware, type ApiKeyVars } from '../middleware/public-api-auth'
import { apiKeyHasScope } from '../lib/api-keys'
import { errorResponse } from '../lib/error-handler'
import { OPENAPI_V3_SPEC } from '../lib/openapi-v3-spec'
import { withIdempotency } from '../lib/idempotency'
import { generateJoinCode } from '../lib/code'
import { ulid } from '../lib/ulid'
import { validateBody } from '../lib/request-validation'
import { recordApiUsage, getApiUsageForTeam } from '../lib/api-usage'
import { getTeamRegionConfig, resolveWriteBinding } from '../lib/db-router'
import {
  listSessionsForTeam,
  fetchSessionForTeam,
  fetchSessionResultsData,
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
      return errorResponse(c, 403, 'forbidden', 'read scope required')
    }
    const sessions = await listSessionsForTeam(c.env.DB, c.get('apiKey').teamId)
    return c.json({ ok: true, data: { sessions, apiVersion: 3 } })
  })

  app.post('/sessions', async (c) => {
    if (!apiKeyHasScope(c.get('apiKey'), 'write')) {
      return errorResponse(c, 403, 'forbidden', 'write scope required')
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
      return errorResponse(c, 403, 'forbidden', 'read scope required')
    }
    const { teamId } = c.get('apiKey')
    const sessionId = c.req.param('id')
    const session = await fetchSessionForTeam(c.env.DB, sessionId, teamId)
    if (!session) {
      return errorResponse(c, 404, 'not_found', 'Session not found')
    }
    const { questions, voteCounts } = await fetchSessionResultsData(c.env.DB, sessionId)
    return c.json({
      ok: true,
      data: { session, questions, vote_counts: voteCounts },
    })
  })

  app.get('/usage', async (c) => {
    const kv = c.env.ACTIONS_KV ?? c.env.INTEGRATIONS_KV
    if (!kv) {
      return errorResponse(c, 503, 'unavailable', 'Usage metering unavailable')
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
