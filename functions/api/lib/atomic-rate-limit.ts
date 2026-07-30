/**
 * ADR-0073 / WS-1 — Atomic rate-limit facade over Workers Rate Limiting + KV.
 *
 * Critical constraints (do not "simplify" away):
 *  - `simple.period` is only 10 or 60 on the Workers binding — long product
 *    windows stay on KV (Tier B dual-layer lands in WS-4, not here).
 *  - Limit budgets are binding-static; profiles map to Env bindings, they do
 *    not accept a runtime `max`.
 *  - Workers RL returns only `{ success }` — `remaining` is non-authoritative
 *    for `backend: 'workers_rl'`.
 *  - Colo-local / permissive accuracy — not a global ledger.
 *  - Empty keys are denied (shared empty-key bucket would be an abuse hole).
 *
 * WS-1 ships the facade + tests only. No production callers until WS-2
 * (API-key canary). While `ATOMIC_RATE_LIMIT_ENABLED` is false, this falls
 * back to the existing KV helper when a profile declares `kvFallback`.
 */

import type { Env } from '../types'
import { getFlag } from './flags'
import { logEvent } from './log'
import { rateLimit } from './rate-limit'

export type AtomicRateLimitBackend = 'workers_rl' | 'kv' | 'bypass' | 'deny'

export type AtomicRateLimitResult = {
  allowed: boolean
  backend: AtomicRateLimitBackend
  /** Configured binding/KV max — for X-RateLimit-Limit headers. */
  limit: number
  /** Window length in seconds (binding period or KV window). */
  periodSec: number
  /**
   * Best-effort remaining. Authoritative only for `backend: 'kv'`.
   * For Workers RL: `0` on deny, `limit` on allow (non-authoritative).
   */
  remaining: number
  resetAt: number
  retryAfterSec: number
}

/** Profiles that map 1:1 onto a `[[ratelimits]]` binding (ADR registry). */
export type AtomicRateLimitProfile =
  | 'api_key'
  | 'embed_read'
  | 'embed_handshake'
  | 'join'
  | 'public_event'
  | 'webhook'
  | 'auth_burst'
  | 'report_burst'
  | 'kb_search'
  | 'admin_audit_query'

type BindingName =
  | 'RL_API_KEY'
  | 'RL_EMBED_READ'
  | 'RL_EMBED_HANDSHAKE'
  | 'RL_JOIN'
  | 'RL_PUBLIC_EVENT'
  | 'RL_WEBHOOK'
  | 'RL_AUTH_BURST'
  | 'RL_REPORT_BURST'
  | 'RL_KB_SEARCH'
  | 'RL_ADMIN_AUDIT_Q'

type ProfileConfig = {
  binding: BindingName
  limit: number
  periodSec: 60
  /** Used when flag off / binding missing — soft KV path (lib/rate-limit). */
  kvFallback: { max: number; windowSeconds: number; prefix: string }
}

/**
 * Static profile registry. Budgets must match wrangler `[[ratelimits]]` and
 * RATE_LIMIT_BINDINGS_SETUP.md — change both in the same PR.
 */
export const ATOMIC_RATE_LIMIT_PROFILES: Record<AtomicRateLimitProfile, ProfileConfig> = {
  api_key: {
    binding: 'RL_API_KEY',
    limit: 120,
    periodSec: 60,
    kvFallback: { max: 120, windowSeconds: 60, prefix: 'atomic-api-key' },
  },
  embed_read: {
    binding: 'RL_EMBED_READ',
    limit: 120,
    periodSec: 60,
    kvFallback: { max: 120, windowSeconds: 60, prefix: 'atomic-embed-read' },
  },
  embed_handshake: {
    binding: 'RL_EMBED_HANDSHAKE',
    limit: 30,
    periodSec: 60,
    kvFallback: { max: 30, windowSeconds: 60, prefix: 'atomic-embed-hs' },
  },
  join: {
    binding: 'RL_JOIN',
    limit: 20,
    periodSec: 60,
    kvFallback: { max: 20, windowSeconds: 60, prefix: 'atomic-join' },
  },
  public_event: {
    binding: 'RL_PUBLIC_EVENT',
    limit: 60,
    periodSec: 60,
    kvFallback: { max: 60, windowSeconds: 60, prefix: 'atomic-public-event' },
  },
  webhook: {
    binding: 'RL_WEBHOOK',
    limit: 100,
    periodSec: 60,
    kvFallback: { max: 100, windowSeconds: 60, prefix: 'atomic-webhook' },
  },
  auth_burst: {
    binding: 'RL_AUTH_BURST',
    limit: 5,
    periodSec: 60,
    kvFallback: { max: 5, windowSeconds: 60, prefix: 'atomic-auth-burst' },
  },
  report_burst: {
    binding: 'RL_REPORT_BURST',
    limit: 5,
    periodSec: 60,
    kvFallback: { max: 5, windowSeconds: 60, prefix: 'atomic-report-burst' },
  },
  kb_search: {
    binding: 'RL_KB_SEARCH',
    limit: 60,
    periodSec: 60,
    kvFallback: { max: 60, windowSeconds: 60, prefix: 'atomic-kb-search' },
  },
  admin_audit_query: {
    binding: 'RL_ADMIN_AUDIT_Q',
    limit: 120,
    periodSec: 60,
    kvFallback: { max: 120, windowSeconds: 60, prefix: 'atomic-admin-audit-q' },
  },
}

function bindingOf(env: Env, name: BindingName): RateLimit | undefined {
  return env[name]
}

function denyResult(
  profile: ProfileConfig,
  backend: AtomicRateLimitBackend,
  now = Date.now(),
): AtomicRateLimitResult {
  const resetAt = now + profile.periodSec * 1000
  return {
    allowed: false,
    backend,
    limit: profile.limit,
    periodSec: profile.periodSec,
    remaining: 0,
    resetAt,
    retryAfterSec: profile.periodSec,
  }
}

function allowWorkers(profile: ProfileConfig, now = Date.now()): AtomicRateLimitResult {
  const resetAt = now + profile.periodSec * 1000
  return {
    allowed: true,
    backend: 'workers_rl',
    limit: profile.limit,
    periodSec: profile.periodSec,
    // Non-authoritative — Workers RL does not return remaining.
    remaining: profile.limit,
    resetAt,
    retryAfterSec: profile.periodSec,
  }
}

async function kvFallback(
  env: Env,
  key: string,
  profile: ProfileConfig,
): Promise<AtomicRateLimitResult> {
  const kv = env.ACTIONS_KV
  const failClosed = getFlag(env, 'RATE_LIMIT_FAIL_CLOSED')
  const r = await rateLimit(kv, key, {
    ...profile.kvFallback,
    failClosed,
  })
  const retryAfterSec = Math.max(1, Math.ceil((r.resetAt - Date.now()) / 1000))
  return {
    allowed: r.allowed,
    backend: kv ? 'kv' : 'bypass',
    limit: profile.limit,
    periodSec: profile.kvFallback.windowSeconds,
    remaining: r.remaining,
    resetAt: r.resetAt,
    retryAfterSec,
  }
}

/**
 * Consume one unit for `key` under `profile`.
 *
 * @param key Stable actor id (api key id, wid:origin, ip hash, …). Must be non-empty.
 */
export async function atomicRateLimit(
  env: Env,
  profileName: AtomicRateLimitProfile,
  key: string,
): Promise<AtomicRateLimitResult> {
  const profile = ATOMIC_RATE_LIMIT_PROFILES[profileName]
  const now = Date.now()

  if (!key || !key.trim()) {
    logEvent({
      event: 'rate_limit.empty_key',
      profile: profileName,
      level: 'warn',
    })
    return denyResult(profile, 'deny', now)
  }

  const atomicOn = getFlag(env, 'ATOMIC_RATE_LIMIT_ENABLED')
  const binding = bindingOf(env, profile.binding)

  if (atomicOn && binding) {
    try {
      const { success } = await binding.limit({ key })
      if (!success) {
        return denyResult(profile, 'workers_rl', now)
      }
      return allowWorkers(profile, now)
    } catch (err) {
      logEvent({
        event: 'rate_limit.workers_rl_failure',
        profile: profileName,
        binding: profile.binding,
        error: err instanceof Error ? err.message : String(err),
        level: 'error',
      })
      // Fall through to KV / fail-closed — do not hard-500 the request path.
    }
  } else if (atomicOn && !binding) {
    logEvent({
      event: 'rate_limit.backend_fallback',
      profile: profileName,
      reason: 'binding_missing',
      level: 'warn',
    })
  }

  if (getFlag(env, 'RATE_LIMIT_FAIL_CLOSED') && !env.ACTIONS_KV) {
    return denyResult(profile, 'deny', now)
  }

  return kvFallback(env, key, profile)
}

/** Test helper — scripted Workers RateLimit binding. */
export function fakeRateLimitBinding(outcomes: boolean[]): RateLimit {
  let i = 0
  return {
    async limit(_opts: { key: string }) {
      const success = outcomes[Math.min(i, outcomes.length - 1)] ?? true
      i += 1
      return { success }
    },
  }
}
