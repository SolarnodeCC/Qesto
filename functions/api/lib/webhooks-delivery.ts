// WEBHOOK-01 — Outbound webhook delivery, retries, and fan-out.

import type { Env } from '../types'
import { writeEvent } from './observability'
import { checkWebhookRateLimit } from './webhook-rate-limit'
import { ulid } from './ulid'
import { validateWebhookTargetUrl } from './webhook-url'
import { hmacSha256Hex } from './webhooks-crypto'
import { loadTeamWebhookIds, loadWebhookConfig } from './webhooks-store'
import type {
  DeliveryEntry,
  WebhookConfig,
  WebhookEvent,
  WebhookPayload,
} from './webhooks-types'
import {
  DELIVERY_LOG_MAX_ENTRIES,
  DELIVERY_LOG_TTL_SECONDS,
  DELIVERY_TIMEOUT_MS,
  MAX_DELIVERY_ATTEMPTS,
  RETRY_BACKOFF_MS,
  webhookDeliveryKey,
} from './webhooks-types'

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
  const next = [entry, ...existing].slice(0, DELIVERY_LOG_MAX_ENTRIES)
  await kv.put(webhookDeliveryKey(webhookId), JSON.stringify(next), {
    expirationTtl: DELIVERY_LOG_TTL_SECONDS,
  })
}

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
  const urlCheck = validateWebhookTargetUrl(url)
  if (!urlCheck.ok) {
    return { statusCode: null, success: false, durationMs: 0, error: `blocked: ${urlCheck.message}` }
  }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      method: 'POST',
      redirect: 'manual',
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

/** Deliver a single webhook with HMAC signature, retries, and delivery-log persistence. */
export async function deliverWebhook(
  config: WebhookConfig,
  payload: WebhookPayload,
  integrationsKv: KVNamespace,
  metricsEnv?: Pick<Env, 'METRICS_AE'>,
): Promise<void> {
  if (!config.enabled) return
  if (!config.events.includes(payload.event)) return

  const allowed = await checkWebhookRateLimit(integrationsKv, config.teamId)
  if (!allowed) {
    writeEvent(metricsEnv?.METRICS_AE, {
      name: 'webhook.failed',
      teamId: config.teamId,
      detail: `${config.id}:rate_limited`,
    })
    return
  }

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
    if (attempt > 1) {
      writeEvent(metricsEnv?.METRICS_AE, {
        name: 'webhook.retried',
        teamId: config.teamId,
        count: attempt,
        detail: config.id,
      })
    }

    if (result.success) {
      writeEvent(metricsEnv?.METRICS_AE, {
        name: 'webhook.delivered',
        teamId: config.teamId,
        durationMs: result.durationMs,
        detail: config.id,
      })
      return
    }

    if (attempt < MAX_DELIVERY_ATTEMPTS) {
      const wait = RETRY_BACKOFF_MS[attempt - 1] ?? 0
      if (wait > 0) await sleep(wait)
    }
  }

  try {
    const { enqueueWebhookDlq } = await import('./webhook-dlq')
    await enqueueWebhookDlq(integrationsKv, {
      webhookId: config.id,
      teamId: config.teamId,
      event: payload.event,
      url: config.url,
      payload: payload.data,
      error: `All ${MAX_DELIVERY_ATTEMPTS} delivery attempts failed`,
      attempts: MAX_DELIVERY_ATTEMPTS,
    })
  } catch {
    /* ignore */
  }

  writeEvent(metricsEnv?.METRICS_AE, {
    name: 'webhook.failed',
    teamId: config.teamId,
    detail: config.id,
  })
}

/** Fan out an event to all enabled team webhooks subscribed to it. */
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

export async function listDeliveries(
  kv: KVNamespace,
  webhookId: string,
): Promise<DeliveryEntry[]> {
  return readDeliveryLog(kv, webhookId)
}
