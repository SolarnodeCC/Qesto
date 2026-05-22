// WEBHOOK-01 — Generic outbound webhook delivery.
//
// Stores webhook configs in INTEGRATIONS_KV under:
//   webhook:config:{teamId}:{webhookId}     — WebhookConfig blob
//   webhook:team-index:{teamId}             — string[] webhookIds (reverse index for fast list)
//   webhook:delivery:{webhookId}            — DeliveryEntry[] (last 50, 7-day TTL)
//
// Wire format on outbound POST:
//   Headers:
//     Content-Type:       application/json
//     X-Qesto-Event:      session.closed
//     X-Qesto-Timestamp:  <epoch_ms>
//     X-Qesto-Signature-256: sha256=<hex_hmac>
//   Body: { event, timestamp, data }
//
// Retry policy: up to 3 attempts; sleeps 1000/2000/4000 ms between attempts.
// Each attempt has a 10s timeout. Delivery is best-effort; failures are logged
// to the per-webhook delivery log and do not propagate to the caller.

import type { Env } from '../types'
import { writeEvent } from './observability'
import { ulid } from './ulid'
import { z } from 'zod'
import { validateData, WebhookConfigSchema } from './validators'

const WebhookTeamIndexSchema = z.array(z.string())

// ─── Types ───────────────────────────────────────────────────────────────────

export type WebhookEvent = 'session.closed' | 'session.started' | 'session.energizer'

export const KNOWN_WEBHOOK_EVENTS: readonly WebhookEvent[] = [
  'session.closed',
  'session.started',
  'session.energizer',
] as const

export interface WebhookConfig {
  id: string
  teamId: string
  url: string
  /** HMAC secret — generated server-side on create, never returned after creation. */
  secret: string
  events: WebhookEvent[]
  enabled: boolean
  createdAt: number
  updatedAt: number
  createdBy: string
}

export interface DeliveryEntry {
  id: string
  webhookId: string
  event: string
  url: string
  statusCode: number | null
  success: boolean
  attempt: number
  durationMs: number
  deliveredAt: number
  error?: string
}

export interface WebhookPayload {
  event: WebhookEvent
  timestamp: number
  data: Record<string, unknown>
}

// ─── KV key builders ─────────────────────────────────────────────────────────

export function webhookConfigKey(teamId: string, webhookId: string): string {
  return `webhook:config:${teamId}:${webhookId}`
}

export function webhookTeamIndexKey(teamId: string): string {
  return `webhook:team-index:${teamId}`
}

export function webhookDeliveryKey(webhookId: string): string {
  return `webhook:delivery:${webhookId}`
}

// ─── Constants ───────────────────────────────────────────────────────────────

const DELIVERY_LOG_MAX_ENTRIES = 50
const DELIVERY_LOG_TTL_SECONDS = 7 * 24 * 60 * 60
const DELIVERY_TIMEOUT_MS = 10_000
const RETRY_BACKOFF_MS = [1_000, 2_000, 4_000] as const
const MAX_DELIVERY_ATTEMPTS = RETRY_BACKOFF_MS.length // 3

// ─── HMAC signing ────────────────────────────────────────────────────────────

/**
 * Compute hex HMAC-SHA256 of `body` using `secret`. Returns lower-case hex.
 */
export async function hmacSha256Hex(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body))
  const bytes = new Uint8Array(mac)
  let out = ''
  for (const b of bytes) out += b.toString(16).padStart(2, '0')
  return out
}

/**
 * Generate a 32-byte random hex secret for HMAC signing (64 chars).
 */
export function generateWebhookSecret(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  let out = ''
  for (const b of bytes) out += b.toString(16).padStart(2, '0')
  return out
}

// ─── Delivery log helpers ────────────────────────────────────────────────────

async function readDeliveryLog(kv: KVNamespace, webhookId: string): Promise<DeliveryEntry[]> {
  try {
    const raw = await kv.get(webhookDeliveryKey(webhookId))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as DeliveryEntry[]) : []
  } catch {
    return []
  }
}

async function appendDeliveryLog(
  kv: KVNamespace,
  webhookId: string,
  entry: DeliveryEntry,
): Promise<void> {
  const existing = await readDeliveryLog(kv, webhookId)
  // Prepend newest first, cap at MAX entries.
  const next = [entry, ...existing].slice(0, DELIVERY_LOG_MAX_ENTRIES)
  await kv.put(webhookDeliveryKey(webhookId), JSON.stringify(next), {
    expirationTtl: DELIVERY_LOG_TTL_SECONDS,
  })
}

// ─── Delivery helpers ────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function singleAttempt(
  url: string,
  body: string,
  signature: string,
  event: WebhookEvent,
  timestampMs: number,
): Promise<{ statusCode: number | null; success: boolean; durationMs: number; error?: string }> {
  const started = Date.now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Qesto-Event': event,
        'X-Qesto-Timestamp': String(timestampMs),
        'X-Qesto-Signature-256': `sha256=${signature}`,
        'User-Agent': 'Qesto-Webhook/1.0',
      },
      body,
      signal: controller.signal,
    })
    const durationMs = Date.now() - started
    const success = res.status >= 200 && res.status < 300
    return {
      statusCode: res.status,
      success,
      durationMs,
      ...(success ? {} : { error: `HTTP ${res.status}` }),
    }
  } catch (err) {
    const durationMs = Date.now() - started
    return {
      statusCode: null,
      success: false,
      durationMs,
      error: err instanceof Error ? err.message : String(err),
    }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Deliver a single webhook with HMAC signature, retries, and delivery-log
 * persistence. Never throws — failure surfaces only in the delivery log.
 */
export async function deliverWebhook(
  config: WebhookConfig,
  payload: WebhookPayload,
  integrationsKv: KVNamespace,
  metricsEnv?: Pick<Env, 'METRICS_AE'>,
): Promise<void> {
  if (!config.enabled) return
  if (!config.events.includes(payload.event)) return

  const body = JSON.stringify(payload)
  let signature: string
  try {
    signature = await hmacSha256Hex(config.secret, body)
  } catch (err) {
    await appendDeliveryLog(integrationsKv, config.id, {
      id: ulid(),
      webhookId: config.id,
      event: payload.event,
      url: config.url,
      statusCode: null,
      success: false,
      attempt: 0,
      durationMs: 0,
      deliveredAt: Date.now(),
      error: `HMAC failed: ${err instanceof Error ? err.message : String(err)}`,
    })
    return
  }

  for (let attempt = 1; attempt <= MAX_DELIVERY_ATTEMPTS; attempt++) {
    const result = await singleAttempt(config.url, body, signature, payload.event, payload.timestamp)

    const entry: DeliveryEntry = {
      id: ulid(),
      webhookId: config.id,
      event: payload.event,
      url: config.url,
      statusCode: result.statusCode,
      success: result.success,
      attempt,
      durationMs: result.durationMs,
      deliveredAt: Date.now(),
      ...(result.error ? { error: result.error } : {}),
    }
    // Best-effort log write; ignore failure to avoid masking original error.
    try {
      await appendDeliveryLog(integrationsKv, config.id, entry)
    } catch {
      /* ignore */
    }

    writeEvent(metricsEnv?.METRICS_AE, {
      name: 'webhook.delivery_attempted',
      teamId: config.teamId,
      durationMs: result.durationMs,
      count: attempt,
      detail: `${config.id}:${result.success ? 'ok' : 'fail'}`,
    })

    if (result.success) return

    // Backoff before next attempt (no sleep after final attempt).
    if (attempt < MAX_DELIVERY_ATTEMPTS) {
      const wait = RETRY_BACKOFF_MS[attempt - 1] ?? 0
      if (wait > 0) await sleep(wait)
    }
  }
}

// ─── Team-scoped fan-out ─────────────────────────────────────────────────────

async function loadTeamWebhookIds(kv: KVNamespace, teamId: string): Promise<string[]> {
  try {
    const raw = await kv.get(webhookTeamIndexKey(teamId))
    if (!raw) return []
    return validateData(JSON.parse(raw), WebhookTeamIndexSchema) ?? []
  } catch {
    return []
  }
}

async function loadWebhookConfig(
  kv: KVNamespace,
  teamId: string,
  webhookId: string,
): Promise<WebhookConfig | null> {
  try {
    const raw = await kv.get(webhookConfigKey(teamId, webhookId))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return validateData(parsed, WebhookConfigSchema)
  } catch {
    return null
  }
}

/**
 * Fan out a given event to all enabled webhooks subscribed to it for a team.
 * Safe to invoke via `c.executionCtx.waitUntil(...)`. Per-webhook failures are
 * isolated; one bad endpoint does not stop deliveries to the others.
 */
export async function deliverTeamWebhooks(
  env: Env,
  teamId: string | null,
  event: WebhookEvent,
  data: Record<string, unknown>,
): Promise<void> {
  if (!teamId) return
  if (!env.INTEGRATIONS_KV) return

  const ids = await loadTeamWebhookIds(env.INTEGRATIONS_KV, teamId)
  if (ids.length === 0) return

  const payload: WebhookPayload = {
    event,
    timestamp: Date.now(),
    data,
  }

  const tasks: Promise<void>[] = []
  for (const id of ids) {
    const config = await loadWebhookConfig(env.INTEGRATIONS_KV, teamId, id)
    if (!config) continue
    if (!config.enabled) continue
    if (!config.events.includes(event)) continue
    tasks.push(
      deliverWebhook(config, payload, env.INTEGRATIONS_KV, env).catch((err) => {
        console.error(
          JSON.stringify({
            event: 'webhook.deliver.error',
            webhookId: id,
            teamId,
            error: err instanceof Error ? err.message : String(err),
          }),
        )
      }),
    )
  }
  await Promise.all(tasks)
}

// ─── KV admin helpers (used by routes) ───────────────────────────────────────

export async function saveWebhookConfig(kv: KVNamespace, config: WebhookConfig): Promise<void> {
  await kv.put(webhookConfigKey(config.teamId, config.id), JSON.stringify(config))
}

export async function deleteWebhookConfig(
  kv: KVNamespace,
  teamId: string,
  webhookId: string,
): Promise<void> {
  await kv.delete(webhookConfigKey(teamId, webhookId))
}

export async function loadTeamWebhooks(
  kv: KVNamespace,
  teamId: string,
): Promise<WebhookConfig[]> {
  const ids = await loadTeamWebhookIds(kv, teamId)
  const out: WebhookConfig[] = []
  for (const id of ids) {
    const cfg = await loadWebhookConfig(kv, teamId, id)
    if (cfg) out.push(cfg)
  }
  return out
}

export async function getWebhookConfig(
  kv: KVNamespace,
  teamId: string,
  webhookId: string,
): Promise<WebhookConfig | null> {
  return loadWebhookConfig(kv, teamId, webhookId)
}

export async function addToTeamIndex(
  kv: KVNamespace,
  teamId: string,
  webhookId: string,
): Promise<void> {
  const ids = await loadTeamWebhookIds(kv, teamId)
  if (!ids.includes(webhookId)) {
    ids.push(webhookId)
    await kv.put(webhookTeamIndexKey(teamId), JSON.stringify(ids))
  }
}

export async function removeFromTeamIndex(
  kv: KVNamespace,
  teamId: string,
  webhookId: string,
): Promise<void> {
  const ids = await loadTeamWebhookIds(kv, teamId)
  const next = ids.filter((id) => id !== webhookId)
  if (next.length !== ids.length) {
    await kv.put(webhookTeamIndexKey(teamId), JSON.stringify(next))
  }
}

export async function listDeliveries(
  kv: KVNamespace,
  webhookId: string,
): Promise<DeliveryEntry[]> {
  return readDeliveryLog(kv, webhookId)
}

export async function countTeamWebhooks(kv: KVNamespace, teamId: string): Promise<number> {
  const ids = await loadTeamWebhookIds(kv, teamId)
  return ids.length
}

/**
 * Strip the HMAC secret from a config so it's safe to return in GET/LIST
 * responses. The secret is only returned once at creation time.
 */
export function redactWebhookSecret(config: WebhookConfig): Omit<WebhookConfig, 'secret'> & { secret: string } {
  return { ...config, secret: '***' }
}

export const WEBHOOK_LIMIT_PER_TEAM = 10
