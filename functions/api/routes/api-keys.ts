/**
 * API-KEY-MANAGEMENT-01 — create/list/revoke team API keys.
 */
import { Hono } from 'hono'
import { errorResponse } from '../lib/error-handler'
import { z } from 'zod'
import { authMiddleware, type AuthVariables } from '../middleware/auth'
import { planMiddleware, type PlanVariables } from '../middleware/plan'
import { API_KEY_REVOKED_TTL_SECONDS } from '../lib/constants'
import { readKvJson, writeKvJson, writeKvText } from '../lib/kv'
import { ulid } from '../lib/ulid'
import { validateBody } from '../lib/request-validation'
import {
  generateApiKey,
  hashApiKey,
  apiKeyHashIndexKey,
  apiKeyKvKey,
  teamApiKeyIndexKey,
  isApiKeyActive,
  type ApiKeyRecord,
} from '../lib/api-keys'
import type { Env } from '../types'
import { requireVerifiedEmail } from '../lib/email-verification'
import { requireStepUp } from '../middleware/step-up'
import { loadTeam, requireTeamPermission } from './teams/shared'
import type { Context } from 'hono'

type Vars = AuthVariables & PlanVariables
type C = Context<{ Bindings: Env; Variables: Vars }>

/**
 * A team's API keys are credentials for that team's data, so every operation
 * requires `team:manage_auth` on the key's team (owner/admin, or a custom role
 * granting it). Before this, any authenticated Team-plan user could mint, list,
 * revoke or rotate keys for ANY teamId — minting gave public-API access to
 * another tenant's data, and rotate returned the new secret. Non-members get
 * 404 so team ids cannot be probed. Step-up (DD-04) runs after authorization so
 * a non-member is never prompted for a code.
 */
async function authorizeTeamKeys(c: C, teamId: string): Promise<Response | null> {
  const team = await loadTeam(c.env.TEAMS_KV, teamId)
  const userId = c.get('user').sub
  if (!team || !team.members.some((m) => m.userId === userId)) {
    return errorResponse(c, 404, 'not_found', 'Team not found')
  }
  return requireTeamPermission(c, team, 'team:manage_auth', 'Manage authentication permission required')
}

async function authorizeTeamKeyMutation(c: C, teamId: string): Promise<Response | null> {
  return (await authorizeTeamKeys(c, teamId)) ?? (await requireStepUp(c))
}

const CreateKeySchema = z.object({
  teamId: z.string().min(1),
  name: z.string().min(1).max(80),
  scopes: z.array(z.enum(['read', 'write'])).default(['read']),
})

export function mountApiKeyRoutes(parent: Hono<{ Bindings: Env; Variables: Vars }>) {
  const app = new Hono<{ Bindings: Env; Variables: Vars }>()
  app.use('*', authMiddleware)
  app.use('*', planMiddleware)

  // DD-10: minting a credential for a team requires a proven mailbox.
  app.post('/', requireVerifiedEmail, async (c) => {
    if (c.get('plan') !== 'team') {
      return errorResponse(c, 403, 'upgrade_required', 'API keys require Team plan')
    }
    if (!c.env.INTEGRATIONS_KV) {
      return errorResponse(c, 503, 'kv_unavailable', 'INTEGRATIONS_KV required')
    }
    const parsed = await validateBody(c, CreateKeySchema)
    if ('error' in parsed) return parsed.error
    const denied = await authorizeTeamKeyMutation(c, parsed.data.teamId)
    if (denied) return denied
    const { raw, prefix } = generateApiKey()
    const id = ulid()
    const record: ApiKeyRecord = {
      id,
      teamId: parsed.data.teamId,
      name: parsed.data.name,
      scopes: parsed.data.scopes,
      createdAt: Date.now(),
      createdBy: c.get('user').sub,
      prefix,
    }
    const hash = await hashApiKey(raw)
    await writeKvJson(c.env.INTEGRATIONS_KV, apiKeyKvKey(id), record)
    await writeKvText(c.env.INTEGRATIONS_KV, apiKeyHashIndexKey(hash), id)
    const index = (await readKvJson<string[]>(c.env.INTEGRATIONS_KV, teamApiKeyIndexKey(parsed.data.teamId))) ?? []
    if (!index.includes(id)) {
      index.push(id)
      await writeKvJson(c.env.INTEGRATIONS_KV, teamApiKeyIndexKey(parsed.data.teamId), index)
    }
    return c.json({ ok: true, data: { key: raw, record }, trace_id: c.get('trace_id') }, 201)
  })

  app.get('/', async (c) => {
    const teamId = c.req.query('teamId')
    if (!teamId || !c.env.INTEGRATIONS_KV) {
      return errorResponse(c, 400, 'bad_request', 'teamId required')
    }
    const denied = await authorizeTeamKeys(c, teamId)
    if (denied) return denied
    const index = (await readKvJson<string[]>(c.env.INTEGRATIONS_KV, teamApiKeyIndexKey(teamId))) ?? []
    const keys: ApiKeyRecord[] = []
    for (const id of index) {
      const rec = await readKvJson<ApiKeyRecord>(c.env.INTEGRATIONS_KV, apiKeyKvKey(id))
      if (rec && isApiKeyActive(rec)) keys.push(rec)
    }
    return c.json({ ok: true, data: { keys }, trace_id: c.get('trace_id') })
  })

  app.delete('/:keyId', async (c) => {
    if (!c.env.INTEGRATIONS_KV) {
      return errorResponse(c, 503, 'kv_unavailable', 'INTEGRATIONS_KV required')
    }
    const keyId = c.req.param('keyId')
    const record = await readKvJson<ApiKeyRecord>(c.env.INTEGRATIONS_KV, apiKeyKvKey(keyId))
    if (!record) {
      return errorResponse(c, 404, 'not_found', 'API key not found')
    }
    const denied = await authorizeTeamKeyMutation(c, record.teamId)
    if (denied) return denied
    const updated: ApiKeyRecord = { ...record, revokedAt: Date.now() }
    await writeKvJson(c.env.INTEGRATIONS_KV, apiKeyKvKey(keyId), updated, { expirationTtl: API_KEY_REVOKED_TTL_SECONDS })
    return c.json({ ok: true, data: { revoked: true, record: updated }, trace_id: c.get('trace_id') })
  })

  app.post('/:keyId/rotate', requireVerifiedEmail, async (c) => {
    if (c.get('plan') !== 'team') {
      return errorResponse(c, 403, 'upgrade_required', 'API keys require Team plan')
    }
    if (!c.env.INTEGRATIONS_KV) {
      return errorResponse(c, 503, 'kv_unavailable', 'INTEGRATIONS_KV required')
    }
    const keyId = c.req.param('keyId')
    const record = await readKvJson<ApiKeyRecord>(c.env.INTEGRATIONS_KV, apiKeyKvKey(keyId))
    if (!record || !isApiKeyActive(record)) {
      return errorResponse(c, 404, 'not_found', 'API key not found')
    }
    const denied = await authorizeTeamKeyMutation(c, record.teamId)
    if (denied) return denied
    const revoked: ApiKeyRecord = { ...record, revokedAt: Date.now() }
    await writeKvJson(c.env.INTEGRATIONS_KV, apiKeyKvKey(keyId), revoked, { expirationTtl: API_KEY_REVOKED_TTL_SECONDS })
    const { raw, prefix } = generateApiKey()
    const newId = ulid()
    const replacement: ApiKeyRecord = {
      ...record,
      id: newId,
      prefix,
      createdAt: Date.now(),
      createdBy: c.get('user').sub,
      rotatedAt: Date.now(),
      revokedAt: undefined,
      lastUsedAt: undefined,
    }
    const hash = await hashApiKey(raw)
    await writeKvJson(c.env.INTEGRATIONS_KV, apiKeyKvKey(newId), replacement)
    await writeKvText(c.env.INTEGRATIONS_KV, apiKeyHashIndexKey(hash), newId)
    const index = (await readKvJson<string[]>(c.env.INTEGRATIONS_KV, teamApiKeyIndexKey(record.teamId))) ?? []
    const nextIndex = index.filter((id) => id !== keyId)
    nextIndex.push(newId)
    await writeKvJson(c.env.INTEGRATIONS_KV, teamApiKeyIndexKey(record.teamId), nextIndex)
    return c.json({ ok: true, data: { key: raw, record: replacement, previousKeyId: keyId }, trace_id: c.get('trace_id') }, 201)
  })

  parent.route('/api/api-keys', app)
}
