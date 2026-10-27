// Cloudflare Worker entrypoint for Qesto (API only).
// - Delegates HTTP requests to the shared Hono app (functions/api/app.ts).
// - Re-exports the SessionRoom Durable Object class so the platform can bind
//   the class declared in wrangler.toml (CLAUDE.md hard rule 5: DO only for LIVE).
// - Exports TemplateGenerationWorkflow for Cloudflare Workflows.
// The static frontend SPA is deployed separately to Cloudflare Pages.

import { createApp } from '../functions/api/app'
import type { Env } from '../functions/api/types'
import type { PostSessionWorkMessage } from '../functions/api/lib/queues/producer'
import { runScheduledJobs } from '../functions/api/lib/scheduled-dispatch'
import { SCHEDULED_JOBS } from './scheduled-jobs'
import { handlePostSessionQueue } from './queue-consumer'

export { SessionRoom } from '../functions/api/SessionRoom'
export { TemplateGenerationWorkflow } from './TemplateGenerationWorkflow'

const app = createApp()

async function handleScheduled(event: ScheduledController, env: Env, _ctx: ExecutionContext): Promise<void> {
  await runScheduledJobs(event.cron, env, SCHEDULED_JOBS)
}

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext): Response | Promise<Response> {
    return app.fetch(request, env, ctx)
  },
  scheduled(event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    return handleScheduled(event, env, ctx)
  },
  queue(batch: MessageBatch<unknown>, env: Env): Promise<void> {
    // Only post-session work is produced onto this queue (lib/queues/producer.ts).
    return handlePostSessionQueue(batch as MessageBatch<PostSessionWorkMessage>, env)
  },
} satisfies ExportedHandler<Env>
