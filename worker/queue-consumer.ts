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
      safeLogContext(err, {
        traceId: `queue-${sessionId}`,
        route: 'worker/queue-consumer',
        errorClass: err instanceof Error ? err.name : 'UnknownError',
        details: { taskType, attempts: message.attempts },
      })
      await alertCritical(env, 'worker/queue-consumer', err instanceof Error ? err.name : 'QueueTaskFailed', {
        traceId: `queue-${sessionId}`,
        errorClass: err instanceof Error ? err.name : 'QueueTaskFailed',
        details: { taskType },
      })
    }
  }
}
