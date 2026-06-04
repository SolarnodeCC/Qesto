/**
 * ADR-042 Phase 2.1: Async work queue consumer.
 *
 * Processes queued post-session tasks (insights precomputation, Slack notifications, etc.)
 * This runs in a separate Worker context (not blocking the HTTP response).
 *
 * Retries automatically (max 3 attempts); failures go to DLQ for manual review.
 *
 * @see functions/api/lib/queues/producer.ts (producer)
 */

import type { Env } from '../../types'
import type { PostSessionWorkMessage } from './producer'
import { writeEvent } from '../observability'

/**
 * Handle a single queued work message.
 *
 * Called by the Worker queue consumer binding. You would typically invoke this
 * from a queue handler in the main worker, e.g.:
 *
 * ```typescript
 * export async function queue(batch: MessageBatch<PostSessionWorkMessage>, env: Env, ctx: ExecutionContext) {
 *   for (const message of batch.messages) {
 *     await processPostSessionWork(env, message.body);
 *     message.ack();
 *   }
 * }
 * ```
 *
 * @param env Cloudflare Env
 * @param message PostSessionWorkMessage
 * @throws if processing fails (will cause retry)
 */
export async function processPostSessionWork(
  env: Env,
  message: PostSessionWorkMessage,
): Promise<void> {
  const startMs = Date.now()
  const { taskType, sessionId, teamId, userId, payload, idempotencyKey, meta } = message

  try {
    // Dispatch to task-specific handler
    switch (taskType) {
      case 'precompute_insights':
        await handlePrecomputeInsights(env, sessionId, userId, payload)
        break
      case 'notify_slack':
        await handleNotifySlack(env, sessionId, teamId, payload)
        break
      case 'notify_teams':
        await handleNotifyTeams(env, sessionId, teamId, payload)
        break
      case 'deliver_webhook':
        await handleDeliverWebhook(env, sessionId, teamId, payload)
        break
      case 'deliver_marketing':
        await handleDeliverMarketing(env, sessionId, payload)
        break
      default:
        throw new Error(`Unknown taskType: ${taskType}`)
    }

    const durationMs = Date.now() - startMs
    writeEvent(env.METRICS_AE, {
      name: 'queue.task.success',
      sessionId,
      teamId,
      detail: taskType,
      durationMs,
    })
  } catch (err) {
    const durationMs = Date.now() - startMs
    const errorMsg = err instanceof Error ? err.message : String(err)

    // Log failure + attempt number
    writeEvent(env.METRICS_AE, {
      name: 'queue.task.error',
      sessionId,
      teamId,
      detail: taskType,
      durationMs,
      error: errorMsg,
      attempt: meta.attempt ?? 1,
    })

    console.error(
      JSON.stringify({
        event: 'queue.task.error',
        idempotencyKey,
        taskType,
        sessionId,
        teamId,
        error: errorMsg,
        attempt: meta.attempt ?? 1,
      }),
    )

    // Re-throw to trigger retry (or DLQ after max attempts)
    throw err
  }
}

/**
 * Task handler: precompute AI insights for a closed session.
 * This is the async version of precomputeInsights() from lifecycle.ts.
 */
async function handlePrecomputeInsights(
  env: Env,
  sessionId: string,
  userId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const { sessionTitle, anonymity, plan, traceId } = payload as any

  // TODO: Import and call precomputeInsights() here
  // For now, placeholder that would call:
  // await precomputeInsights(env, sessionId, sessionTitle, userId, { anonymity, teamId, plan, traceId })
  console.log(`[insights queue] precompute for session ${sessionId}`)
}

/**
 * Task handler: send Slack notification for session close.
 */
async function handleNotifySlack(
  env: Env,
  sessionId: string,
  teamId: string | undefined,
  payload: Record<string, unknown>,
): Promise<void> {
  const { counts, total } = payload as any

  // TODO: Import and call notifySlackSessionClosed() here
  // For now, placeholder that would call:
  // await notifySlackSessionClosed(env, sessionId, sessionTitle, teamId, counts, total)
  console.log(`[slack queue] notify for session ${sessionId}`)
}

/**
 * Task handler: send Microsoft Teams notification for session close.
 */
async function handleNotifyTeams(
  env: Env,
  sessionId: string,
  teamId: string | undefined,
  payload: Record<string, unknown>,
): Promise<void> {
  const { counts, total } = payload as any

  // TODO: Import and call notifyTeamsSessionClosed() here
  // For now, placeholder that would call:
  // await notifyTeamsSessionClosed(env, sessionId, sessionTitle, teamId, counts, total)
  console.log(`[teams queue] notify for session ${sessionId}`)
}

/**
 * Task handler: deliver generic team webhook.
 */
async function handleDeliverWebhook(
  env: Env,
  sessionId: string,
  teamId: string | undefined,
  payload: Record<string, unknown>,
): Promise<void> {
  const { webhookUrl, event, data } = payload as any

  // TODO: Import and call deliverWebhook() here
  console.log(`[webhook queue] deliver ${event} for session ${sessionId}`)
}

/**
 * Task handler: deliver marketing webhook.
 */
async function handleDeliverMarketing(
  env: Env,
  sessionId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const {
    isPublic,
    language,
    sessionMode,
    questionCount,
    participantCount,
    responseRate,
    durationMinutes,
    templateUsed,
    energizerUsed,
  } = payload as any

  // TODO: Import and call deliverMarketingWebhook() here
  console.log(`[marketing queue] deliver for session ${sessionId}`)
}
