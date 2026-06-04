// Cloudflare Worker entrypoint for Qesto (API only).
// - Delegates HTTP requests to the shared Hono app (functions/api/app.ts).
// - Re-exports the SessionRoom Durable Object class so the platform can bind
//   the class declared in wrangler.toml (CLAUDE.md hard rule 5: DO only for LIVE).
// - Exports TemplateGenerationWorkflow for Cloudflare Workflows.
// The static frontend SPA is deployed separately to Cloudflare Pages.

import { createApp } from '../functions/api/app'
import type { Env } from '../functions/api/types'
import { safeLogContext } from '../functions/api/lib/log'
import { processPostSessionWork } from '../functions/api/lib/queues/consumer'
import type { PostSessionWorkMessage } from '../functions/api/lib/queues/producer'

export { SessionRoom } from '../functions/api/SessionRoom'
export { TemplateGenerationWorkflow } from './TemplateGenerationWorkflow'

const app = createApp()

async function handleScheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
  // Phase 5: Scheduled KB sync via Cloudflare Workers Cron
  // Triggered by cron schedule defined in wrangler.toml
  // Runs the kb:sync CLI via node-based fetch to internal endpoint

  const adminKey = env.KB_ADMIN_KEY
  const clientId = env.CF_ACCESS_CLIENT_ID
  const clientSecret = env.CF_ACCESS_CLIENT_SECRET

  if (!adminKey || !clientId || !clientSecret) {
    safeLogContext(new Error('Missing credentials'), { traceId: 'cron', route: 'worker/kb-sync-cron', errorClass: 'MissingCredentials' })
    return
  }

  try {
    console.log('[kb-sync-cron] Starting scheduled KB sync')

    // This cron job would typically:
    // 1. Fetch list of pending KB changes from git
    // 2. Call the kb:sync CLI via subprocess or fetch
    // 3. Post results to Slack/email

    // For now, log the intent
    console.log('[kb-sync-cron] Scheduled sync ready. Awaiting git webhook trigger.')
  } catch (err) {
    safeLogContext(err, { traceId: 'cron', route: 'worker/kb-sync-cron', errorClass: err instanceof Error ? err.name : 'UnknownError' })
  }
}

async function handleQueue(
  batch: MessageBatch<PostSessionWorkMessage>,
  env: Env,
  ctx: ExecutionContext,
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
        sessionId,
        taskType,
        errorClass: err instanceof Error ? err.name : 'UnknownError',
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
