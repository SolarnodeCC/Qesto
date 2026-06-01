/**
 * API-KEY-MANAGEMENT-01 — create/list/revoke team API keys.
 */
import { Hono } from 'hono'
import { z } from 'zod'
import { authMiddleware, type AuthVariables } from '../middleware/auth'
import { planMiddleware, type PlanVariables } from '../middleware/plan'
import { readKvJson, writeKvJson } from '../lib/kv'
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

type Vars = AuthVariables & PlanVariables

const CreateKeySchema = z.object({
  teamId: z.string().min(1),
  name: z.string().min(1).max(80),
  scopes: z.array(z.enum(['read', 'write'])).default(['read']),
})

export function mountApiKeyRoutes(parent: Hono<{ Bindings: Env; Variables: Vars }>) {
  const app = new Hono<{ Bindings: Env; Variables: Vars }>()
  app.use('*', authMiddleware)
  app.use('*', planMiddleware)

  app.post('/', async (c) => {
    if (c.get('plan') !== 'team') {
      return c.json({ ok: false, error: { code: 'upgrade_required', message: 'API keys require Team plan' }, trace_id: c.get('trace_id') }, 403)
    }
    if (!c.env.INTEGRATIONS_KV) {
      return c.json({ ok: false, error: { code: 'kv_unavailable', message: 'INTEGRATIONS_KV required' }, trace_id: c.get('trace_id') }, 503)
    }
    const parsed = await validateBody(c, CreateKeySchema)
    if ('error' in parsed) return parsed.error
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
    await c.env.INTEGRATIONS_KV.put(apiKeyHashIndexKey(hash), id)
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
      return c.json({ ok: false, error: { code: 'bad_request', message: 'teamId required' }, trace_id: c.get('trace_id') }, 400)
    }
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
      return c.json({ ok: false, error: { code: 'kv_unavailable', message: 'INTEGRATIONS_KV required' }, trace_id: c.get('trace_id') }, 503)
    }
    const keyId = c.req.param('keyId')
    const record = await readKvJson<ApiKeyRecord>(c.env.INTEGRATIONS_KV, apiKeyKvKey(keyId))
    if (!record) {
      return c.json({ ok: false, error: { code: 'not_found', message: 'API key not found' }, trace_id: c.get('trace_id') }, 404)
    }
    const updated: ApiKeyRecord = { ...record, revokedAt: Date.now() }
    await writeKvJson(c.env.INTEGRATIONS_KV, apiKeyKvKey(keyId), updated)
    return c.json({ ok: true, data: { revoked: true, record: updated }, trace_id: c.get('trace_id') })
  })

  app.post('/:keyId/rotate', async (c) => {
    if (c.get('plan') !== 'team') {
      return c.json({ ok: false, error: { code: 'upgrade_required', message: 'API keys require Team plan' }, trace_id: c.get('trace_id') }, 403)
    }
    if (!c.env.INTEGRATIONS_KV) {
      return c.json({ ok: false, error: { code: 'kv_unavailable', message: 'INTEGRATIONS_KV required' }, trace_id: c.get('trace_id') }, 503)
    }
    const keyId = c.req.param('keyId')
    const record = await readKvJson<ApiKeyRecord>(c.env.INTEGRATIONS_KV, apiKeyKvKey(keyId))
    if (!record || !isApiKeyActive(record)) {
      return c.json({ ok: false, error: { code: 'not_found', message: 'API key not found' }, trace_id: c.get('trace_id') }, 404)
    }
    const revoked: ApiKeyRecord = { ...record, revokedAt: Date.now() }
    await writeKvJson(c.env.INTEGRATIONS_KV, apiKeyKvKey(keyId), revoked)
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
    await c.env.INTEGRATIONS_KV.put(apiKeyHashIndexKey(hash), newId)
    const index = (await readKvJson<string[]>(c.env.INTEGRATIONS_KV, teamApiKeyIndexKey(record.teamId))) ?? []
    const nextIndex = index.filter((id) => id !== keyId)
    nextIndex.push(newId)
    await writeKvJson(c.env.INTEGRATIONS_KV, teamApiKeyIndexKey(record.teamId), nextIndex)
    return c.json({ ok: true, data: { key: raw, record: replacement, previousKeyId: keyId }, trace_id: c.get('trace_id') }, 201)
  })

  parent.route('/api/api-keys', app)
}
