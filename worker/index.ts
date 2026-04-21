// Cloudflare Worker entrypoint for Qesto (API only).
// - Delegates HTTP requests to the shared Hono app (functions/api/app.ts).
// - Re-exports the SessionRoom Durable Object class so the platform can bind
//   the class declared in wrangler.toml (CLAUDE.md hard rule 5: DO only for LIVE).
// The static frontend SPA is deployed separately to Cloudflare Pages.

import { createApp } from '../functions/api/app'
import type { Env } from '../functions/api/types'

export { SessionRoom } from '../functions/api/SessionRoom'

const app = createApp()

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext): Response | Promise<Response> {
    return app.fetch(request, env, ctx)
  },
} satisfies ExportedHandler<Env>
