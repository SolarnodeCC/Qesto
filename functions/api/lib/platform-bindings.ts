/**
 * Runtime probes for critical Cloudflare bindings and feature flags.
 * Used by /api/admin/health, deploy smoke scripts, and operator audits.
 */

import { getFlag } from './flags'
import type { Env } from '../types'

export type BindingProbe = {
  /** Binding or flag name (e.g. SESSION_ROOM, INSIGHTS_QUEUE). */
  name: string
  /** Whether the binding is present and callable in this runtime. */
  bound: boolean
  /** Whether this binding is required for core product operation. */
  required: boolean
  /** Raw config value or short diagnostic. */
  detail?: string
}

export type PlatformBindingsReport = {
  ok: boolean
  /** True when any required binding is missing. */
  degraded: boolean
  missingRequired: string[]
  probes: BindingProbe[]
}

export function probeSessionRoomBinding(env: Pick<Env, 'SESSION_ROOM'>): BindingProbe {
  const bound = typeof env.SESSION_ROOM?.idFromName === 'function'
  return {
    name: 'SESSION_ROOM',
    bound,
    required: true,
    detail: bound ? 'durable_object' : 'missing',
  }
}

export function probeInsightsQueueBinding(env: Pick<Env, 'INSIGHTS_QUEUE'>): BindingProbe {
  const bound = typeof env.INSIGHTS_QUEUE?.send === 'function'
  return {
    name: 'INSIGHTS_QUEUE',
    bound,
    required: true,
    detail: bound ? 'queue_producer' : 'missing',
  }
}

export function probeIntegrationFlag(env: Pick<Env, 'INTEGRATION_ENABLED'>): BindingProbe {
  const raw = env.INTEGRATION_ENABLED ?? 'missing'
  const effective = getFlag(env, 'INTEGRATION_ENABLED')
  return {
    name: 'INTEGRATION_ENABLED',
    bound: effective,
    required: false,
    detail: `raw=${raw}; effective=${effective}`,
  }
}

/** Aggregate binding health for admin health + deploy smoke. */
export function summarizePlatformBindings(env: Env): PlatformBindingsReport {
  const probes = [
    probeSessionRoomBinding(env),
    probeInsightsQueueBinding(env),
    probeIntegrationFlag(env),
  ]
  const missingRequired = probes.filter((p) => p.required && !p.bound).map((p) => p.name)
  const degraded = missingRequired.length > 0
  return {
    ok: !degraded,
    degraded,
    missingRequired,
    probes,
  }
}
