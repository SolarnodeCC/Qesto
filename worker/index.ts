// Cloudflare Worker entrypoint for Qesto (API only).
// - Delegates HTTP requests to the shared Hono app (functions/api/app.ts).
// - Re-exports the SessionRoom Durable Object class so the platform can bind
//   the class declared in wrangler.toml (CLAUDE.md hard rule 5: DO only for LIVE).
// - Exports TemplateGenerationWorkflow for Cloudflare Workflows.
// The static frontend SPA is deployed separately to Cloudflare Pages.

import { createApp } from '../functions/api/app'
import type { Env } from '../functions/api/types'
import { safeLogContext } from '../functions/api/lib/log'
import { alertCritical } from '../functions/api/lib/alerts'
import { processPostSessionWork } from '../functions/api/lib/queues/consumer'
import type { PostSessionWorkMessage } from '../functions/api/lib/queues/producer'
import { runScheduledJobs } from '../functions/api/lib/scheduled-dispatch'
import { SCHEDULED_JOBS } from './scheduled-jobs'

export { SessionRoom } from '../functions/api/SessionRoom'
export { TemplateGenerationWorkflow } from './TemplateGenerationWorkflow'

const app = createApp()

async function handleScheduled(event: ScheduledEvent, env: Env, _ctx: ExecutionContext): Promise<void> {
  await runScheduledJobs(event.cron, env, SCHEDULED_JOBS)
}

async function handleQueue(
  batch: MessageBatch<PostSessionWorkMessage>,
  env: Env,
  _ctx: ExecutionContext,
): Promise<void> {
  // Phase 2.1: Async post-session work consumer
  // Processes enqueued tasks: insights, Slack/Teams notifications, webhooks, marketing
  // Retries up to max_retries (defined in wrangler.toml); final failures go to DLQ
  const messages = batch.messages || []

  for (const message of messages) {
    try {
      await processPostSessionWork(env, message.body)
      message.ack()
    } catch (err) {
      // Nack to trigger retry (or DLQ after max retries)
      message.nack()
      const sessionId = message.body?.sessionId || 'unknown'
      const taskType = message.body?.taskType || 'unknown'
      safeLogContext(err, {
        traceId: 'queue',
        route: 'worker/queue-consumer',
        errorClass: err instanceof Error ? err.name : 'UnknownError',
      })
      await alertCritical(env, 'worker/queue-consumer', err instanceof Error ? err.name : 'QueueTaskFailed', {
        traceId: `queue-${sessionId}`,
        errorClass: err instanceof Error ? err.name : 'QueueTaskFailed',
        details: { taskType },
      })
    }
  }
}

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext): Response | Promise<Response> {
    return app.fetch(request, env, ctx)
  },
  scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    return handleScheduled(event, env, ctx)
  },
  queue(batch: MessageBatch<PostSessionWorkMessage>, env: Env, ctx: ExecutionContext): Promise<void> {
    return handleQueue(batch, env, ctx)
  },
} satisfies ExportedHandler<Env>
