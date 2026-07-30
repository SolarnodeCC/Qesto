/**
 * Shared Bearer API key auth + per-key rate limit (SEC-APIKEY-QUOTA-01).
 *
 * ADR-0073 / WS-2 canary: when `ATOMIC_RATE_LIMIT_ENABLED=true`, allow/deny goes
 * through `atomicRateLimit` (`RL_API_KEY`). Flag off keeps the legacy KV
 * read-modify-write path byte-compatible for rollback (<5 min config flip).
 */
import type { Context, Next } from 'hono'
import { API_KEY_RECORD_TTL_SECONDS } from '../lib/constants'
import { readKvJson, writeKvJson, readKvText } from '../lib/kv'
import {
  ApiKeyRecordSchema,
  apiKeyHashIndexKey,
  apiKeyKvKey,
  apiKeyRateLimitKey,
  hashApiKey,
  isApiKeyActive,
  type ApiKeyRecord,
} from '../lib/api-keys'
import { atomicRateLimit } from '../lib/atomic-rate-limit'
import { getFlag } from '../lib/flags'
import { writeEvent } from '../lib/observability'
import { incrementAndCheckThreshold, shouldSendQuotaNotification } from '../lib/tenant-quota'
import type { Env } from '../types'

export type ApiKeyVars = { apiKey: ApiKeyRecord }

const KEY_LIMIT_PER_MIN = 120
const KEY_WINDOW_SEC = 60
const API_KEY_FORMAT = /^qesto_[0-9a-f]{32}$/

async function legacyKvRateLimit(
  env: Env,
  keyId: string,
  teamId: string,
): Promise<{ limited: boolean }> {
  const rlKv = env.ACTIONS_KV ?? env.INTEGRATIONS_KV
  if (!rlKv) return { limited: false }
  const windowStart = Math.floor(Date.now() / 1000 / KEY_WINDOW_SEC) * KEY_WINDOW_SEC
  const rlKey = apiKeyRateLimitKey(keyId, windowStart)
  const count = Number((await rlKv.get(rlKey)) ?? '0')
  if (count >= KEY_LIMIT_PER_MIN) {
    writeEvent(env.METRICS_AE, {
      name: 'rate_limit.hit',
      teamId,
      profile: 'api_key',
      backend: 'kv',
      detail: `actor=key:${keyId}`,
    })
    return { limited: true }
  }
  await rlKv.put(rlKey, String(count + 1), { expirationTtl: KEY_WINDOW_SEC * 2 })
  return { limited: false }
}

/**
 * Dual-write the legacy KV counter while Workers RL is authoritative (canary).
 * Metrics / comparison only — never overrides an allow/deny decision.
 */
async function dualWriteLegacyKv(env: Env, keyId: string): Promise<void> {
  const rlKv = env.ACTIONS_KV ?? env.INTEGRATIONS_KV
  if (!rlKv) return
  try {
    const windowStart = Math.floor(Date.now() / 1000 / KEY_WINDOW_SEC) * KEY_WINDOW_SEC
    const rlKey = apiKeyRateLimitKey(keyId, windowStart)
    const count = Number((await rlKv.get(rlKey)) ?? '0')
    await rlKv.put(rlKey, String(count + 1), { expirationTtl: KEY_WINDOW_SEC * 2 })
  } catch {
    /* fail-open: dual-write must not affect the request */
  }
}

export async function publicApiKeyMiddleware(c: Context<{ Bindings: Env; Variables: ApiKeyVars }>, next: Next) {
  const auth = c.req.header('authorization')
  if (!auth?.startsWith('Bearer ')) {
    return c.json({ ok: false, error: { code: 'unauthenticated', message: 'Bearer API key required' } }, 401)
  }
  const raw = auth.slice(7).trim()
  // Cheap format gate before hashing + KV lookups: keys are only ever minted
  // as `qesto_` + 32 hex chars (generateApiKey), so anything else is garbage.
  if (!API_KEY_FORMAT.test(raw)) {
    return c.json({ ok: false, error: { code: 'unauthenticated', message: 'Invalid API key' } }, 401)
  }
  if (!c.env.INTEGRATIONS_KV) {
    return c.json({ ok: false, error: { code: 'unavailable', message: 'API keys not configured' } }, 503)
  }
  const hash = await hashApiKey(raw)
  const keyId = await readKvText(c.env.INTEGRATIONS_KV, apiKeyHashIndexKey(hash))
  if (!keyId) {
    return c.json({ ok: false, error: { code: 'unauthenticated', message: 'Invalid API key' } }, 401)
  }
  const record = await readKvJson<ApiKeyRecord>(c.env.INTEGRATIONS_KV, apiKeyKvKey(keyId))
  const parsed = record ? ApiKeyRecordSchema.safeParse(record) : null
  if (!parsed?.success || !isApiKeyActive(parsed.data)) {
    return c.json({ ok: false, error: { code: 'unauthenticated', message: 'Invalid or revoked API key' } }, 401)
  }

  const apiKeyId = parsed.data.id
  const teamId = parsed.data.teamId

  if (getFlag(c.env, 'ATOMIC_RATE_LIMIT_ENABLED')) {
    const rl = await atomicRateLimit(c.env, 'api_key', apiKeyId)
    if (!rl.allowed) {
      writeEvent(c.env.METRICS_AE, {
        name: 'rate_limit.hit',
        teamId,
        profile: 'api_key',
        backend: rl.backend,
        detail: `actor=key:${apiKeyId}`,
      })
      return c.json(
        { ok: false, error: { code: 'rate_limited', message: 'API key quota exceeded' } },
        429,
        { 'Retry-After': String(rl.retryAfterSec) },
      )
    }
    // Canary dual-write: L1 (Workers RL) decided allow; mirror into legacy KV.
    if (rl.backend === 'workers_rl') {
      await dualWriteLegacyKv(c.env, apiKeyId)
    }
  } else {
    const { limited } = await legacyKvRateLimit(c.env, apiKeyId, teamId)
    if (limited) {
      return c.json(
        { ok: false, error: { code: 'rate_limited', message: 'API key quota exceeded' } },
        429,
        { 'Retry-After': String(KEY_WINDOW_SEC) },
      )
    }
  }

  const updated: ApiKeyRecord = { ...parsed.data, lastUsedAt: Date.now() }
  await writeKvJson(c.env.INTEGRATIONS_KV, apiKeyKvKey(parsed.data.id), updated, {
    expirationTtl: API_KEY_RECORD_TTL_SECONDS,
  })

  writeEvent(c.env.METRICS_AE, {
    name: 'api.request',
    teamId: parsed.data.teamId,
    detail: `${c.req.method} ${c.req.path}`,
  })

  // ENTERPRISE-POLISH s8a: quota overage threshold detection.
  // Fire at 80% (warn) and 100% (exceeded) -- once per day per level.
  try {
    const quotaKv = c.env.ACTIONS_KV ?? c.env.INTEGRATIONS_KV
    if (quotaKv) {
      const { threshold } = await incrementAndCheckThreshold(quotaKv, parsed.data.teamId)
      if (threshold !== 'ok') {
        const shouldNotify = await shouldSendQuotaNotification(quotaKv, parsed.data.teamId, threshold)
        if (shouldNotify) {
          writeEvent(c.env.METRICS_AE, {
            name: 'api.request',
            teamId: parsed.data.teamId,
            detail: `quota_${threshold}`,
          })
        }
      }
    }
  } catch { /* fail-open: quota tracking must not block requests */ }

  c.set('apiKey', updated)
  await next()
}
