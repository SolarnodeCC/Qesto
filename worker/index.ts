// Cloudflare Worker entrypoint for Qesto.
// - Delegates HTTP requests to the shared Hono app (functions/api/app.ts).
// - Re-exports the SessionRoom Durable Object class so the platform can bind
//   the class declared in wrangler.toml (CLAUDE.md hard rule 5: DO only for LIVE).
// Static assets are served by the `[assets]` runtime first; only unmatched
// paths (e.g. /api/*) fall through to this Worker.

import { createApp } from '../functions/api/app'
import type { Env } from '../functions/api/types'

export { SessionRoom } from '../functions/api/SessionRoom'

const app = createApp()

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext): Response | Promise<Response> {
    return app.fetch(request, env, ctx)
  },
} satisfies ExportedHandler<Env>
