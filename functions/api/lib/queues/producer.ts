/**
 * ADR-042 Phase 2.1: Async work queue producer.
 *
 * Enqueues post-session work (AI insights, Slack/Teams notifications, recaps, webhooks)
 * instead of running them via waitUntil(). This:
 * - Removes post-session work from the close request path (improves latency)
 * - Provides retry + DLQ semantics (improves reliability)
 * - Allows parallel processing via multiple consumers
 *
 * When INSIGHTS_QUEUE is not bound (local/dev or misconfigured deploy), falls back
 * to `executionCtx.waitUntil(processPostSessionWork(...))` so close still triggers
 * post-session work. Missing binding is logged as an error (not a silent warn).
 *
 * Queue: qesto-insights (max 10 messages per batch, 30s timeout, 3 retries, DLQ)
 *
 * @see knowledge-base/adr/ADR-042-cloudflare-capability-expansion.md (Phase 2.1)
 * @see functions/api/routes/sessions/lifecycle-close.ts (where work is enqueued)
 */

import type { Env } from '../../types'
import { safeLogContext } from '../log'

export type PostSessionWorkMessage = {
  /**
   * Unique idempotency key: prevents duplicate processing if message is retried.
   * Format: `{sessionId}:{taskType}:{hash(payload)}`
   */
  idempotencyKey: string

  /**
   * Session ID (required for all tasks)
   */
  sessionId: string

  /**
   * Team ID (optional; used for Slack/Teams lookups)
   */
  teamId?: string

  /**
   * User ID (owner of the session)
   */
  userId: string

  /**
   * Task type: determines which consumer logic runs
   */
  taskType: 'precompute_insights' | 'pulse_rollup' | 'notify_slack' | 'notify_teams' | 'deliver_webhook' | 'deliver_marketing'

  /**
   * Task-specific payload
   */
  payload: {
    // precompute_insights
    sessionTitle?: string
    anonymity?: string | null
    plan?: string
    traceId?: string

    // notify_slack / notify_teams
    counts?: Record<string, number>
    total?: number

    // deliver_webhook
    webhookUrl?: string
    event?: string
    data?: Record<string, unknown>

    // deliver_marketing
    isPublic?: boolean
    language?: string
    sessionMode?: string
    questionCount?: number
    participantCount?: number
    responseRate?: number
    durationMinutes?: number
    templateUsed?: string | null
    energizerUsed?: boolean
  }

  /**
   * Metadata for observability
   */
  meta: {
    enqueuedAt: number // timestamp
    attempt?: number // retry attempt (starts at 1)
  }
}

export type EnqueueResult = 'queued' | 'fallback' | 'dropped'

export type EnqueueOptions = {
  /** When set and the queue binding is missing, run the consumer via waitUntil. */
  executionCtx?: ExecutionContext
}

/**
 * Enqueue a post-session work task, or fall back to waitUntil when unbound.
 *
 * @returns `'queued'` when sent to Cloudflare Queues; `'fallback'` when the
 *   waitUntil consumer path ran; `'dropped'` when neither path is available.
 */
export async function enqueuePostSessionWork(
  env: Env,
  message: PostSessionWorkMessage,
  opts: EnqueueOptions = {},
): Promise<EnqueueResult> {
  const traceId =
    (typeof message.payload.traceId === 'string' && message.payload.traceId) ||
    message.idempotencyKey

  if (!env.INSIGHTS_QUEUE) {
    safeLogContext(new Error('INSIGHTS_QUEUE binding missing — post-session work using waitUntil fallback or dropping'), {
      traceId,
      route: 'queues/producer',
      errorClass: 'QueueBindingMissing',
      statusCode: 500,
    })

    if (opts.executionCtx) {
      opts.executionCtx.waitUntil(
        (async () => {
          const { processPostSessionWork } = await import('./consumer')
          try {
            await processPostSessionWork(env, message)
          } catch (err) {
            safeLogContext(err, {
              traceId,
              route: 'queues/producer.waitUntil',
              errorClass: err instanceof Error ? err.name : 'UnknownError',
              statusCode: 500,
            })
          }
        })(),
      )
      return 'fallback'
    }

    console.error(
      JSON.stringify({
        event: 'queue.enqueue.dropped',
        taskType: message.taskType,
        sessionId: message.sessionId,
        reason: 'INSIGHTS_QUEUE_unbound_no_executionCtx',
      }),
    )
    return 'dropped'
  }

  try {
    await env.INSIGHTS_QUEUE.send(message)
    return 'queued'
  } catch (err) {
    safeLogContext(err, {
      traceId,
      route: 'queues/producer',
      errorClass: err instanceof Error ? err.name : 'QueueEnqueueError',
      statusCode: 500,
    })
    // Enqueue failures are non-fatal for the HTTP close path. Prefer waitUntil
    // so the work still runs when the queue briefly rejects.
    if (opts.executionCtx) {
      opts.executionCtx.waitUntil(
        (async () => {
          const { processPostSessionWork } = await import('./consumer')
          try {
            await processPostSessionWork(env, message)
          } catch (fallbackErr) {
            safeLogContext(fallbackErr, {
              traceId,
              route: 'queues/producer.waitUntil',
              errorClass: fallbackErr instanceof Error ? fallbackErr.name : 'UnknownError',
              statusCode: 500,
            })
          }
        })(),
      )
      return 'fallback'
    }
    return 'dropped'
  }
}

/**
 * Compute a deterministic hash of a payload for idempotency.
 * Used to create idempotencyKey = `{sessionId}:{taskType}:{payloadHash}`
 *
 * This ensures retried messages with identical payloads use the same key,
 * preventing double-processing.
 */
export function computePayloadHash(payload: Record<string, unknown>): string {
  const sorted = Object.keys(payload)
    .sort()
    .map((k) => `${k}=${JSON.stringify(payload[k])}`)
    .join('|')
  // Simple hash: bitwise ops (not cryptographic, just for deduplication)
  let hash = 0
  for (let i = 0; i < sorted.length; i++) {
    const char = sorted.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // convert to 32-bit
  }
  return Math.abs(hash).toString(16)
}
