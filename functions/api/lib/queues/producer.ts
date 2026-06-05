/**
 * ADR-042 Phase 2.1: Async work queue producer.
 *
 * Enqueues post-session work (AI insights, Slack/Teams notifications, recaps, webhooks)
 * instead of running them via waitUntil(). This:
 * - Removes post-session work from the close request path (improves latency)
 * - Provides retry + DLQ semantics (improves reliability)
 * - Allows parallel processing via multiple consumers
 *
 * Queue: qesto-insights (max 10 messages per batch, 30s timeout, 3 retries, DLQ)
 *
 * @see knowledge-base/adr/ADR-042-cloudflare-capability-expansion.md (Phase 2.1)
 * @see functions/api/routes/sessions/lifecycle.ts (where work is enqueued)
 */

import type { Env } from '../../types'

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
  taskType: 'precompute_insights' | 'notify_slack' | 'notify_teams' | 'deliver_webhook' | 'deliver_marketing'

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

/**
 * Enqueue a post-session work task.
 *
 * @param env Cloudflare Env (must have INSIGHTS_QUEUE binding)
 * @param message PostSessionWorkMessage
 * @returns Promise that resolves when message is enqueued (not when processed)
 *
 * @example
 * await enqueuePostSessionWork(c.env, {
 *   idempotencyKey: `${id}:precompute_insights:${hash}`,
 *   sessionId: id,
 *   userId: user.sub,
 *   taskType: 'precompute_insights',
 *   payload: { sessionTitle: session.title, plan: c.get('plan') },
 *   meta: { enqueuedAt: Date.now() },
 * });
 */
export async function enqueuePostSessionWork(
  env: Env,
  message: PostSessionWorkMessage,
): Promise<void> {
  if (!env.INSIGHTS_QUEUE) {
    console.warn('[2.1 Queues] INSIGHTS_QUEUE not bound; falling back to no-op')
    return
  }

  try {
    await env.INSIGHTS_QUEUE.send(message)
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    console.error(
      JSON.stringify({
        event: 'queue.enqueue.error',
        taskType: message.taskType,
        sessionId: message.sessionId,
        error: errorMsg,
      }),
    )
    // Don't throw: enqueue failures are non-fatal. Work can be retried later.
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
