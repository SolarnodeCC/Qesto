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
import { precomputeInsights } from '../../routes/sessions/shared'
import { notifySlackSessionClosed, notifyTeamsSessionClosed } from '../../routes/integrations'
import { deliverTeamWebhooks } from '../webhooks'
import { deliverMarketingWebhook } from '../webhooks-marketing'

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
    console.log(
      JSON.stringify({
        event: 'queue.task.success',
        idempotencyKey,
        taskType,
        sessionId,
        durationMs,
      }),
    )
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)

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
  const { sessionTitle, anonymity, plan, traceId } = payload
  if (!sessionTitle || typeof sessionTitle !== 'string') {
    throw new Error('Missing or invalid sessionTitle in payload')
  }
  const plans: Array<'free' | 'starter' | 'team'> = ['free', 'starter', 'team']
  const planValue = (plans as readonly string[]).includes(plan as string) ? (plan as 'free' | 'starter' | 'team') : 'free'

  await precomputeInsights(env, sessionId, sessionTitle, userId, {
    anonymity: anonymity as string | null,
    teamId: null, // Fetched inside precomputeInsights
    plan: planValue,
    traceId: traceId as string,
  })
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
  const { counts, total } = payload
  if (!counts || typeof counts !== 'object' || typeof total !== 'number') {
    throw new Error('Missing or invalid counts/total in payload')
  }

  // Fetch session title for the notification
  const session = await env.DB.prepare('SELECT title FROM sessions WHERE id = ?1')
    .bind(sessionId)
    .first<{ title: string }>()

  if (!session) {
    throw new Error(`Session ${sessionId} not found`)
  }

  await notifySlackSessionClosed(env, sessionId, session.title, teamId ?? null, counts as Record<string, number>, total)
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
  const { counts, total } = payload
  if (!counts || typeof counts !== 'object' || typeof total !== 'number') {
    throw new Error('Missing or invalid counts/total in payload')
  }

  // Fetch session title for the notification
  const session = await env.DB.prepare('SELECT title FROM sessions WHERE id = ?1')
    .bind(sessionId)
    .first<{ title: string }>()

  if (!session) {
    throw new Error(`Session ${sessionId} not found`)
  }

  await notifyTeamsSessionClosed(env, sessionId, session.title, teamId ?? null, counts as Record<string, number>, total)
}

/**
 * Task handler: deliver generic team webhook.
 */
async function handleDeliverWebhook(
  env: Env,
  _sessionId: string,
  teamId: string | undefined,
  payload: Record<string, unknown>,
): Promise<void> {
  const { event, data } = payload
  if (!event || typeof event !== 'string' || !data || typeof data !== 'object') {
    throw new Error('Missing or invalid event/data in payload')
  }

  // event is expected to be 'session.closed' but deliverTeamWebhooks accepts any string
  await deliverTeamWebhooks(env, teamId ?? null, event as 'session.closed', data as Record<string, unknown>)
}

/**
 * Task handler: deliver marketing webhook.
 */
async function handleDeliverMarketing(
  env: Env,
  sessionId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const { isPublic, language, sessionMode, questionCount, participantCount, responseRate } = payload
  if (typeof isPublic !== 'boolean' || typeof questionCount !== 'number' || typeof participantCount !== 'number') {
    throw new Error('Missing or invalid payload fields for marketing webhook')
  }

  const langs = ['en', 'nl', 'de', 'fr'] as const
  const modes = ['reflection', 'fun', 'townhall', 'stage', 'retro'] as const
  const langValue = (langs as readonly string[]).includes(language as string) ? (language as 'en' | 'nl' | 'de' | 'fr') : 'en'
  const modeValue = (modes as readonly string[]).includes(sessionMode as string)
    ? (sessionMode as 'reflection' | 'fun' | 'townhall' | 'stage' | 'retro')
    : 'reflection'

  await deliverMarketingWebhook(env, {
    sessionId,
    isPublic,
    language: langValue,
    sessionMode: modeValue,
    questionCount,
    participantCount,
    responseRate: (responseRate as number) || 0,
    durationMinutes: 0, // Not needed for webhook
    templateUsed: null,
    energizerUsed: false,
  })
}
