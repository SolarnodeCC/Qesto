// Per-route rate limiter backed by ACTIONS_KV.
//
// Key shape: `ratelimit:<namespace>:<ipHash>:<windowStart>` — collapsing on
// `windowStart` means each key lives at most `windowSec` and is GC'd
// automatically via `expirationTtl = windowSec * 2`.
//
// Default fail-open on KV errors. Set RATE_LIMIT_FAIL_CLOSED=true (SEC-RATELIMIT-01)
// to return 503 when ACTIONS_KV is unavailable.

import type { MiddlewareHandler } from 'hono'
import type { Env } from '../types'
import { logEvent } from '../lib/log'
import { getFlag } from '../lib/flags'
import { readKvText, writeKvText } from '../lib/kv'

export type RateLimitNamespace =
  | 'auth'
  | 'session-create'
  | 'join'
  | 'kb-search'
  | 'admin-destructive'
  | 'admin-audit'
  | 'report-content'

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
  // Trust ONLY cf-connecting-ip (SEC M-6). It is set by the Cloudflare edge and
  // cannot be spoofed by the client. The x-forwarded-for / x-real-ip fallbacks
  // were attacker-controllable and allowed per-request rate-limit bucket
  // rotation, defeating the limiter.
  return req.headers.get('cf-connecting-ip') ?? 'unknown'
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
    const host = new URL(c.req.url).hostname
    if (host === 'localhost' || host === '127.0.0.1') {
      return next()
    }

    const nowSec = Math.floor(Date.now() / 1000)
    const windowStart = Math.floor(nowSec / windowSec) * windowSec
    const windowEnd = windowStart + windowSec
    const retryAfter = Math.max(1, windowEnd - nowSec)

    let count = 0
    let kvAvailable = true
    try {
      const ipHash = await hashIp(c.req.raw)
      const key = `ratelimit:${namespace}:${ipHash}:${windowStart}`
      const raw = await readKvText(c.env.ACTIONS_KV, key)
      count = raw ? Number.parseInt(raw, 10) || 0 : 0

      // Always emit standard rate-limit headers so clients can implement
      // adaptive backoff without waiting for a 429 (RFC 6585 s4).
      const remaining = Math.max(0, limit - count)
      c.header('X-RateLimit-Limit', String(limit))
      c.header('X-RateLimit-Remaining', String(remaining))
      c.header('X-RateLimit-Reset', String(windowEnd))

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

      await writeKvText(c.env.ACTIONS_KV, key, String(count + 1), { expirationTtl: windowSec * 2 })
    } catch (err) {
      kvAvailable = false
      logEvent({
          event: 'rate_limit_kv_error',
          ts: new Date().toISOString(),
          level: 'error',
          namespace,
          trace_id: c.get('trace_id') ?? 'unknown',
          error: (err as Error).message,
        })
      if (getFlag(c.env, 'RATE_LIMIT_FAIL_CLOSED')) {
        return c.json(
          {
            ok: false,
            error: { code: 'rate_limit_unavailable', message: 'Rate limiting temporarily unavailable' },
            trace_id: c.get('trace_id') ?? 'unknown',
          },
          503,
        )
      }
    }

    void kvAvailable
    await next()
  }
}
