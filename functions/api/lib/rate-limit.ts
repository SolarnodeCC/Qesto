// Simple fixed-window rate limiter backed by KV.
//
// Keyed by a caller identifier (e.g. client IP or normalised email). For each
// key we maintain a counter with a TTL equal to the window; once the counter
// exceeds `max`, further calls are rejected until the KV entry expires.
//
// Trade-offs (documented because this matters for the abuse model):
//   • KV writes are eventually consistent — a determined attacker hitting many
//     edges in the same millisecond can beat the limit briefly. For the
//     magic-link endpoint this is acceptable because a small burst sends only
//     a handful of emails; the hard limit is Resend's upstream quota.
//   • We always allow the call if KV isn't bound (pre-bootstrap / tests),
//     matching the graceful degradation pattern already used by
//     `withIdempotency`.
//
// For stronger semantics (Durable-Object-backed atomic counter) see ADR-0001
// and the future WebSocket rate limiter in SessionRoom.

import { validateData, RateLimitCounterSchema } from './protocol-schemas'
import { logEvent } from './log'

export type RateLimitResult = {
  allowed: boolean
  remaining: number
  resetAt: number
}

export type RateLimitOptions = {
  /** Maximum calls allowed inside the window. */
  max: number
  /** Window length, in seconds. Minimum 60 due to KV TTL floor. */
  windowSeconds: number
  /** Namespace prefix so callers can't collide. */
  prefix: string
}

function kvKey(prefix: string, id: string): string {
  return `rl:${prefix}:${id}`
}

/**
 * Increment the counter for `id`, returning whether the call is allowed.
 * If `kv` is undefined (tests / pre-bootstrap), always allow.
 */
export type RateLimitKvOptions = RateLimitOptions & { failClosed?: boolean }

export async function rateLimit(
  kv: KVNamespace | undefined,
  id: string,
  opts: RateLimitKvOptions,
): Promise<RateLimitResult> {
  const fallbackResetAt = () => Date.now() + opts.windowSeconds * 1000
  if (!kv) {
    return { allowed: true, remaining: opts.max, resetAt: fallbackResetAt() }
  }
  try {
    const key = kvKey(opts.prefix, id)
    const raw = await kv.get(key, 'json')
    const now = Date.now()
    const existing = validateData(raw, RateLimitCounterSchema)

    if (existing && existing.resetAt > now) {
      if (existing.count >= opts.max) {
        return { allowed: false, remaining: 0, resetAt: existing.resetAt }
      }
      const next = { count: existing.count + 1, resetAt: existing.resetAt }
      // Preserve remaining TTL — use absolute expiration.
      const ttl = Math.max(60, Math.ceil((existing.resetAt - now) / 1000))
      await kv.put(key, JSON.stringify(next), { expirationTtl: ttl })
      return { allowed: true, remaining: opts.max - next.count, resetAt: existing.resetAt }
    }

    // Fresh window.
    const resetAt = now + opts.windowSeconds * 1000
    await kv.put(key, JSON.stringify({ count: 1, resetAt }), {
      expirationTtl: Math.max(60, opts.windowSeconds),
    })
    return { allowed: true, remaining: opts.max - 1, resetAt }
  } catch (err) {
    logEvent({
        event: 'rate_limit.kv_failure',
        prefix: opts.prefix,
        error: err instanceof Error ? err.message : String(err),
      })
    if (opts.failClosed) {
      return { allowed: false, remaining: 0, resetAt: fallbackResetAt() }
    }
    return { allowed: true, remaining: opts.max, resetAt: fallbackResetAt() }
  }
}
