/**
 * Shared Bearer API key auth + per-key rate limit (SEC-APIKEY-QUOTA-01).
 */
import type { Context, Next } from 'hono'
import { readKvJson, writeKvJson } from '../lib/kv'
import {
  ApiKeyRecordSchema,
  apiKeyHashIndexKey,
  apiKeyKvKey,
  apiKeyRateLimitKey,
  hashApiKey,
  isApiKeyActive,
  type ApiKeyRecord,
} from '../lib/api-keys'
import { writeEvent } from '../lib/observability'
import type { Env } from '../types'

export type ApiKeyVars = { apiKey: ApiKeyRecord }

const KEY_LIMIT_PER_MIN = 120
const KEY_WINDOW_SEC = 60

export async function publicApiKeyMiddleware(c: Context<{ Bindings: Env; Variables: ApiKeyVars }>, next: Next) {
  const auth = c.req.header('authorization')
  if (!auth?.startsWith('Bearer ')) {
    return c.json({ ok: false, error: { code: 'unauthenticated', message: 'Bearer API key required' } }, 401)
  }
  const raw = auth.slice(7).trim()
  if (!c.env.INTEGRATIONS_KV) {
    return c.json({ ok: false, error: { code: 'unavailable', message: 'API keys not configured' } }, 503)
  }
  const hash = await hashApiKey(raw)
  const keyId = await c.env.INTEGRATIONS_KV.get(apiKeyHashIndexKey(hash))
  if (!keyId) {
    return c.json({ ok: false, error: { code: 'unauthenticated', message: 'Invalid API key' } }, 401)
  }
  const record = await readKvJson<ApiKeyRecord>(c.env.INTEGRATIONS_KV, apiKeyKvKey(keyId))
  const parsed = record ? ApiKeyRecordSchema.safeParse(record) : null
  if (!parsed?.success || !isApiKeyActive(parsed.data)) {
    return c.json({ ok: false, error: { code: 'unauthenticated', message: 'Invalid or revoked API key' } }, 401)
  }

  const rlKv = c.env.ACTIONS_KV ?? c.env.INTEGRATIONS_KV
  const windowStart = Math.floor(Date.now() / 1000 / KEY_WINDOW_SEC) * KEY_WINDOW_SEC
  const rlKey = apiKeyRateLimitKey(parsed.data.id, windowStart)
  const count = Number((await rlKv.get(rlKey)) ?? '0')
  if (count >= KEY_LIMIT_PER_MIN) {
    writeEvent(c.env.METRICS_AE, {
      name: 'rate_limit.hit',
      teamId: parsed.data.teamId,
      detail: `api_key:${parsed.data.id}`,
    })
    return c.json(
      { ok: false, error: { code: 'rate_limited', message: 'API key quota exceeded' } },
      429,
      { 'Retry-After': String(KEY_WINDOW_SEC) },
    )
  }
  await rlKv.put(rlKey, String(count + 1), { expirationTtl: KEY_WINDOW_SEC * 2 })

  const updated: ApiKeyRecord = { ...parsed.data, lastUsedAt: Date.now() }
  await writeKvJson(c.env.INTEGRATIONS_KV, apiKeyKvKey(parsed.data.id), updated)

  writeEvent(c.env.METRICS_AE, {
    name: 'api.request',
    teamId: parsed.data.teamId,
    detail: `${c.req.method} ${c.req.path}`,
  })

  c.set('apiKey', updated)
  await next()
}
