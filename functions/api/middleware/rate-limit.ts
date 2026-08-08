/**
 * Per-route rate limiter (ADR-0073).
 *
 * Prefer `{ profile }` (Tier A) or `{ burst, sustained }` (Tier B dual-layer).
 * IP hashed from `cf-connecting-ip` only (SEC M-6).
 */

import type { MiddlewareHandler } from 'hono'
import type { Env } from '../types'
import {
  ATOMIC_RATE_LIMIT_PROFILES,
  atomicRateLimit,
  atomicRateLimitDual,
  type AtomicRateLimitProfile,
  type SustainedKvOpts,
} from '../lib/atomic-rate-limit'
import { writeEvent } from '../lib/observability'
import { getFlag } from '../lib/flags'

export type RateLimitOptions =
  | { profile: AtomicRateLimitProfile }
  | { burst?: AtomicRateLimitProfile; sustained: SustainedKvOpts; profileLabel?: string }

const TE = new TextEncoder()

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', TE.encode(input))
  const bytes = new Uint8Array(digest)
  let out = ''
  for (const b of bytes) out += b.toString(16).padStart(2, '0')
  return out
}

function clientIp(req: Request): string {
  return req.headers.get('cf-connecting-ip') ?? 'unknown'
}

async function hashIp(req: Request): Promise<string> {
  return (await sha256Hex(clientIp(req))).slice(0, 16)
}

type LimiterVariables = { trace_id: string }

function profileLabelOf(options: RateLimitOptions): string {
  if ('profile' in options) return options.profile
  return options.profileLabel ?? options.burst ?? options.sustained.prefix
}

export function rateLimit<V extends LimiterVariables = LimiterVariables>(
  options: RateLimitOptions,
): MiddlewareHandler<{ Bindings: Env; Variables: V }> {
  return async (c, next) => {
    const host = new URL(c.req.url).hostname
    if (host === 'localhost' || host === '127.0.0.1') {
      return next()
    }

    const ipHash = await hashIp(c.req.raw)
    const label = profileLabelOf(options)

    if (getFlag(c.env, 'RATE_LIMIT_FAIL_CLOSED') && !c.env.ACTIONS_KV) {
      return c.json(
        {
          ok: false,
          error: { code: 'rate_limit_unavailable', message: 'Rate limiting temporarily unavailable' },
          trace_id: c.get('trace_id') ?? 'unknown',
        },
        503,
      )
    }

    try {
      const rl =
        'profile' in options
          ? await atomicRateLimit(c.env, options.profile, ipHash)
          : await atomicRateLimitDual(c.env, {
              key: ipHash,
              sustained: options.sustained,
              profileLabel: label,
              ...(options.burst ? { burst: options.burst } : {}),
            })

      const limitHdr =
        'profile' in options
          ? ATOMIC_RATE_LIMIT_PROFILES[options.profile].limit
          : options.sustained.max

      c.header('X-RateLimit-Limit', String(limitHdr))
      c.header('X-RateLimit-Remaining', String(Math.max(0, rl.remaining)))
      c.header('X-RateLimit-Reset', String(Math.ceil(rl.resetAt / 1000)))

      if (!rl.allowed) {
        c.header('Retry-After', String(rl.retryAfterSec))
        writeEvent(c.env.METRICS_AE, {
          name: 'rate_limit.hit',
          profile: label,
          backend: rl.backend,
          detail: `actor=ip:${ipHash}`,
          traceId: c.get('trace_id') ?? undefined,
        })
        return c.json(
          {
            ok: false,
            error: { code: 'rate_limited', message: 'Too many requests', retryAfter: rl.retryAfterSec },
            trace_id: c.get('trace_id') ?? 'unknown',
          },
          429,
        )
      }
    } catch (err) {
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
      void err
    }

    await next()
  }
}
