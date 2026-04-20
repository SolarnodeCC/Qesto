import { createApp } from './app'
import type { Env } from './types'

export { SessionRoom } from './SessionRoom'

const app = createApp()

// Cloudflare Pages Functions entry. Hono accepts a minimal ExecutionContext,
// so we synthesise one from the Pages EventContext.
export const onRequest = (ctx: EventContext<Env, string, Record<string, unknown>>) => {
  const execCtx = {
    waitUntil: ctx.waitUntil.bind(ctx),
    passThroughOnException: ctx.passThroughOnException.bind(ctx),
    props: {},
  } satisfies ExecutionContext
  return app.fetch(ctx.request, ctx.env, execCtx)
}
