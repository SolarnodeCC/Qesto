/**
 * POST /api/client-errors — browser crash / unhandled-rejection telemetry.
 *
 * Before this route the SPA had no error boundary and nothing listened for
 * `error` / `unhandledrejection`: a render crash or failed lazy chunk was a
 * white screen that nobody — not ops, not Sentry — ever heard about.
 *
 * Public by design (crashes happen before/without login) and therefore:
 *   • rate-limited per IP (app.ts mounts a sustained limiter on this path),
 *   • body strictly validated and size-capped,
 *   • every free-text field passes through the PII/secret redactor before it
 *     is logged (safeLogContext), and nothing is stored.
 */
import { Hono } from 'hono'
import { z } from 'zod'
import type { Env } from '../types'
import type { ParentApp } from './parent-app'
import { errorResponse } from '../lib/error-handler'
import { redactSecrets, safeLogContext } from '../lib/log'

type Vars = Record<string, unknown>

const ClientErrorSchema = z.object({
  kind: z.enum(['render', 'error', 'unhandledrejection', 'chunk']),
  message: z.string().min(1).max(500),
  stack: z.string().max(4000).optional(),
  path: z.string().max(300).optional(),
  release: z.string().max(64).optional(),
  traceId: z.string().max(80).optional(),
})

export function mountClientErrorRoutes(parent: ParentApp) {
  const app = new Hono<{ Bindings: Env; Variables: Vars }>()

  app.post('/', async (c) => {
    const parsed = ClientErrorSchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) return errorResponse(c, 400, 'validation', 'Invalid client error report')
    const r = parsed.data
    const err = new Error(redactSecrets(r.message))
    err.name = `Client_${r.kind}`
    if (r.stack) err.stack = redactSecrets(r.stack)
    safeLogContext(err, {
      traceId: (r.traceId && /^[A-Za-z0-9_-]{8,80}$/.test(r.traceId) ? r.traceId : null) ?? (c.get('trace_id') as string | undefined) ?? 'client',
      route: `client:${redactSecrets(r.path ?? 'unknown').split('?')[0]}`,
      errorClass: err.name,
      statusCode: 0,
      details: { release: r.release ?? 'unknown' },
    })
    return c.body(null, 204)
  })

  parent.route('/api/client-errors', app)
}
