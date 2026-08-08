/**
 * ADR-0073 — Atomic rate-limit facade (Workers Rate Limiting + KV).
 *
 * Tier A: `atomicRateLimit(profile)` — L1 Workers RL when flag on, else KV.
 * Tier B: `atomicRateLimitDual({ burst, sustained })` — L1 burst then L2
 *         product-window KV (preserves auth 5/15m, AI 10/h, etc.).
 *
 * Critical constraints:
 *  - Workers `simple.period` ∈ {10,60}; long windows stay on KV (L2).
 *  - Budgets are binding-static; profiles do not accept runtime `max`.
 *  - `remaining` is non-authoritative for `backend: 'workers_rl'`.
 *  - Empty keys are denied.
 */

import type { Env } from '../types'
import { getFlag } from './flags'
import { logEvent } from './log'
import { writeEvent } from './observability'
import { rateLimit } from './rate-limit'

export type AtomicRateLimitBackend = 'workers_rl' | 'kv' | 'bypass' | 'deny'

export type AtomicRateLimitResult = {
  allowed: boolean
  backend: AtomicRateLimitBackend
  limit: number
  periodSec: number
  remaining: number
  resetAt: number
  retryAfterSec: number
}

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
  | 'ai_burst'

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
  | 'RL_AI_BURST'

type ProfileConfig = {
  binding: BindingName
  limit: number
  periodSec: 60
  /** Flag-off / missing-binding soft path — prefixes match pre-migration keys where possible. */
  kvFallback: { max: number; windowSeconds: number; prefix: string }
}

export type SustainedKvOpts = {
  max: number
  windowSeconds: number
  prefix: string
}

export const ATOMIC_RATE_LIMIT_PROFILES: Record<AtomicRateLimitProfile, ProfileConfig> = {
  api_key: {
    binding: 'RL_API_KEY',
    limit: 120,
    periodSec: 60,
    kvFallback: { max: 120, windowSeconds: 60, prefix: 'atomic-api-key' },
  },
  // Match pre-migration embed KV prefixes so flag-off / PEN5 fixtures stay valid.
  embed_read: {
    binding: 'RL_EMBED_READ',
    limit: 120,
    periodSec: 60,
    kvFallback: { max: 120, windowSeconds: 60, prefix: 'embed-read' },
  },
  embed_handshake: {
    binding: 'RL_EMBED_HANDSHAKE',
    limit: 30,
    periodSec: 60,
    kvFallback: { max: 30, windowSeconds: 60, prefix: 'embed-hs' },
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
  ai_burst: {
    binding: 'RL_AI_BURST',
    limit: 10,
    periodSec: 60,
    kvFallback: { max: 10, windowSeconds: 60, prefix: 'atomic-ai-burst' },
  },
}

function bindingOf(env: Env, name: BindingName): RateLimit | undefined {
  return env[name]
}

function denyResult(
  limit: number,
  periodSec: number,
  backend: AtomicRateLimitBackend,
  now = Date.now(),
): AtomicRateLimitResult {
  const resetAt = now + periodSec * 1000
  return {
    allowed: false,
    backend,
    limit,
    periodSec,
    remaining: 0,
    resetAt,
    retryAfterSec: periodSec,
  }
}

function allowWorkers(profile: ProfileConfig, now = Date.now()): AtomicRateLimitResult {
  const resetAt = now + profile.periodSec * 1000
  return {
    allowed: true,
    backend: 'workers_rl',
    limit: profile.limit,
    periodSec: profile.periodSec,
    remaining: profile.limit,
    resetAt,
    retryAfterSec: profile.periodSec,
  }
}

async function runKv(
  env: Env,
  key: string,
  opts: SustainedKvOpts,
): Promise<AtomicRateLimitResult> {
  const kv = env.ACTIONS_KV
  const failClosed = getFlag(env, 'RATE_LIMIT_FAIL_CLOSED')
  const r = await rateLimit(kv, key, { ...opts, failClosed })
  const retryAfterSec = Math.max(1, Math.ceil((r.resetAt - Date.now()) / 1000))
  return {
    allowed: r.allowed,
    backend: kv ? 'kv' : 'bypass',
    limit: opts.max,
    periodSec: opts.windowSeconds,
    remaining: r.remaining,
    resetAt: r.resetAt,
    retryAfterSec,
  }
}

async function tryWorkersRl(
  env: Env,
  profileName: AtomicRateLimitProfile,
  key: string,
): Promise<AtomicRateLimitResult | 'fallback'> {
  const profile = ATOMIC_RATE_LIMIT_PROFILES[profileName]
  const atomicOn = getFlag(env, 'ATOMIC_RATE_LIMIT_ENABLED')
  if (!atomicOn) return 'fallback'

  const binding = bindingOf(env, profile.binding)
  if (!binding) {
    logEvent({
      event: 'rate_limit.backend_fallback',
      profile: profileName,
      reason: 'binding_missing',
      level: 'warn',
    })
    writeEvent(env.METRICS_AE, {
      name: 'rate_limit.backend_fallback',
      profile: profileName,
      backend: 'kv',
      detail: `reason=binding_missing;binding=${profile.binding}`,
    })
    return 'fallback'
  }

  try {
    const { success } = await binding.limit({ key })
    if (!success) return denyResult(profile.limit, profile.periodSec, 'workers_rl')
    return allowWorkers(profile)
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    logEvent({
      event: 'rate_limit.workers_rl_failure',
      profile: profileName,
      binding: profile.binding,
      error,
      level: 'error',
    })
    writeEvent(env.METRICS_AE, {
      name: 'rate_limit.backend_fallback',
      profile: profileName,
      backend: 'kv',
      detail: `reason=workers_rl_error;binding=${profile.binding}`,
    })
    return 'fallback'
  }
}

/**
 * Tier A — single budget (Workers RL when flag on, else profile KV fallback).
 */
export async function atomicRateLimit(
  env: Env,
  profileName: AtomicRateLimitProfile,
  key: string,
): Promise<AtomicRateLimitResult> {
  const profile = ATOMIC_RATE_LIMIT_PROFILES[profileName]

  if (!key || !key.trim()) {
    logEvent({ event: 'rate_limit.empty_key', profile: profileName, level: 'warn' })
    return denyResult(profile.limit, profile.periodSec, 'deny')
  }

  const workers = await tryWorkersRl(env, profileName, key)
  if (workers !== 'fallback') return workers

  if (getFlag(env, 'RATE_LIMIT_FAIL_CLOSED') && !env.ACTIONS_KV) {
    return denyResult(profile.limit, profile.periodSec, 'deny')
  }

  return runKv(env, key, profile.kvFallback)
}

/**
 * Tier B — L1 burst (optional profile) then L2 sustained KV product window.
 * Sustained always runs on allow from L1 so long windows stay product-correct.
 */
export async function atomicRateLimitDual(
  env: Env,
  opts: {
    key: string
    burst?: AtomicRateLimitProfile
    sustained: SustainedKvOpts
    /** Profile label for AE when only sustained applies. */
    profileLabel?: string
  },
): Promise<AtomicRateLimitResult> {
  const { key, burst, sustained, profileLabel = burst ?? 'sustained' } = opts

  if (!key || !key.trim()) {
    logEvent({ event: 'rate_limit.empty_key', profile: profileLabel, level: 'warn' })
    return denyResult(sustained.max, sustained.windowSeconds, 'deny')
  }

  if (burst) {
    const burstResult = await tryWorkersRl(env, burst, key)
    if (burstResult !== 'fallback' && !burstResult.allowed) {
      return burstResult
    }
    // If Workers RL allowed, still enforce sustained KV.
    // If fallback, sustained KV is the only gate (flag off / missing binding).
  }

  if (getFlag(env, 'RATE_LIMIT_FAIL_CLOSED') && !env.ACTIONS_KV) {
    return denyResult(sustained.max, sustained.windowSeconds, 'deny')
  }

  return runKv(env, key, sustained)
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
