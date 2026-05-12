// Per-route rate limiter backed by ACTIONS_KV.
//
// Key shape: `ratelimit:<namespace>:<ipHash>:<windowStart>` — collapsing on
// `windowStart` means each key lives at most `windowSec` and is GC'd
// automatically via `expirationTtl = windowSec * 2`.
//
// Fail-open: if KV throws (transient outage) we log the error and allow the
// request through rather than locking legit traffic out.

import type { MiddlewareHandler } from 'hono'
import type { Env } from '../types'

export type RateLimitNamespace = 'auth' | 'session-create' | 'join' | 'kb-search'

export type RateLimitOptions = {
  namespace: RateLimitNamespace
  limit: number
  windowSec: number
}

const TE = new TextEncoder()

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', TE.encode(input))
  const bytes = new Uint8Array(digest)
  let out = ''
  for (const b of bytes) out += b.toString(16).padStart(2, '0')
  return out
}

function clientIp(req: Request): string {
  return (
    req.headers.get('cf-connecting-ip') ??
    req.headers.get('x-forwarded-for') ??
    req.headers.get('x-real-ip') ??
    'unknown'
  )
}

async function hashIp(req: Request): Promise<string> {
  return (await sha256Hex(clientIp(req))).slice(0, 16)
}

type LimiterVariables = { trace_id: string }

export function rateLimit<V extends LimiterVariables = LimiterVariables>(
  options: RateLimitOptions,
): MiddlewareHandler<{ Bindings: Env; Variables: V }> {
  const { namespace, limit, windowSec } = options
  return async (c, next) => {
    const nowSec = Math.floor(Date.now() / 1000)
    const windowStart = Math.floor(nowSec / windowSec) * windowSec
    const windowEnd = windowStart + windowSec
    const retryAfter = Math.max(1, windowEnd - nowSec)

    let count = 0
    let kvAvailable = true
    try {
      const ipHash = await hashIp(c.req.raw)
      const key = `ratelimit:${namespace}:${ipHash}:${windowStart}`
      const raw = await c.env.ACTIONS_KV.get(key)
      count = raw ? Number.parseInt(raw, 10) || 0 : 0

      if (count >= limit) {
        c.header('Retry-After', String(retryAfter))
        return c.json(
          {
            ok: false,
            error: { code: 'rate_limited', message: 'Too many requests', retryAfter },
            trace_id: c.get('trace_id') ?? 'unknown',
          },
          429,
        )
      }

      await c.env.ACTIONS_KV.put(key, String(count + 1), { expirationTtl: windowSec * 2 })
    } catch (err) {
      // Deny-open: KV failure must not block legit traffic.
      kvAvailable = false
      console.log(
        JSON.stringify({
          ts: new Date().toISOString(),
          level: 'error',
          msg: 'rate_limit_kv_error',
          namespace,
          trace_id: c.get('trace_id') ?? 'unknown',
          error: (err as Error).message,
        }),
      )
    }

    // Suppress unused-var lint when KV was skipped.
    void kvAvailable
    await next()
  }
}
