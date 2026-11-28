// Post-session work queue consumer (Phase 2.1, #938).
//
// Processes enqueued tasks: insights, Slack/Teams notifications, webhooks,
// marketing. Retries up to max_retries (wrangler.toml); final failures go to
// the DLQ.
//
// Each message is acked or retried individually. Cloudflare's Message API is
// ack()/retry() — there is no nack(). An earlier version called nack(), which
// threw a TypeError inside the catch block: the failure was never logged or
// paged, and the rest of the batch was abandoned for that invocation.

import type { Env } from '../functions/api/types'
import { safeLogContext } from '../functions/api/lib/log'
import { alertCritical } from '../functions/api/lib/alerts'
import { processPostSessionWork } from '../functions/api/lib/queues/consumer'
import type { PostSessionWorkMessage } from '../functions/api/lib/queues/producer'

/** Must match wrangler.toml [[queues.consumers]] max_retries. */
export const QUEUE_MAX_RETRIES = 3

export async function handlePostSessionQueue(
  batch: MessageBatch<PostSessionWorkMessage>,
  env: Env,
  process: typeof processPostSessionWork = processPostSessionWork,
): Promise<void> {
  for (const message of batch.messages ?? []) {
    try {
      await process(env, message.body)
      message.ack()
    } catch (err) {
      // Redeliver later (or route to the DLQ once max_retries is exhausted).
      message.retry()
      const sessionId = message.body?.sessionId || 'unknown'
      const taskType = message.body?.taskType || 'unknown'
      // Keep the producer's trace id so the close request and its async work
      // correlate in logs (it used to be replaced with `queue-<sessionId>`).
      const payloadTrace = message.body?.payload?.traceId
      const traceId = typeof payloadTrace === 'string' && payloadTrace ? payloadTrace : `queue-${sessionId}`
      safeLogContext(err, {
        traceId,
        route: 'worker/queue-consumer',
        errorClass: err instanceof Error ? err.name : 'UnknownError',
        details: { taskType, attempts: message.attempts },
      })
      // Page only when the message is about to go to the DLQ — retries are
      // expected and used to page on every attempt.
      if ((message.attempts ?? 1) > QUEUE_MAX_RETRIES) {
        await alertCritical(env, 'worker/queue-consumer', err instanceof Error ? err.name : 'QueueTaskFailed', {
          traceId,
          errorClass: err instanceof Error ? err.name : 'QueueTaskFailed',
          details: { taskType, attempts: message.attempts },
        })
      }
    }
  }
}
