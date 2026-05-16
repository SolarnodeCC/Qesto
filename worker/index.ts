// Cloudflare Worker entrypoint for Qesto (API only).
// - Delegates HTTP requests to the shared Hono app (functions/api/app.ts).
// - Re-exports the SessionRoom Durable Object class so the platform can bind
//   the class declared in wrangler.toml (CLAUDE.md hard rule 5: DO only for LIVE).
// The static frontend SPA is deployed separately to Cloudflare Pages.

import { createApp } from '../functions/api/app'
import type { Env } from '../functions/api/types'

export { SessionRoom } from '../functions/api/SessionRoom'

const app = createApp()

async function handleScheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
  // Phase 5: Scheduled KB sync via Cloudflare Workers Cron
  // Triggered by cron schedule defined in wrangler.toml
  // Runs the kb:sync CLI via node-based fetch to internal endpoint

  const adminKey = env.KB_ADMIN_KEY
  const clientId = env.CF_ACCESS_CLIENT_ID
  const clientSecret = env.CF_ACCESS_CLIENT_SECRET

  if (!adminKey || !clientId || !clientSecret) {
    console.error('[kb-sync-cron] Missing credentials')
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
    console.error('[kb-sync-cron] Error:', err instanceof Error ? err.message : String(err))
  }
}

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext): Response | Promise<Response> {
    return app.fetch(request, env, ctx)
  },
  scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    return handleScheduled(event, env, ctx)
  },
} satisfies ExportedHandler<Env>
