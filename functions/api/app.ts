import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { mountAuthRoutes } from './routes/auth'
import { mountSessionRoutes } from './routes/sessions'
import { authMiddleware, type AuthVariables } from './middleware/auth'
import type { PlanVariables } from './middleware/plan'
import type { Env } from './types'

type Vars = AuthVariables & PlanVariables

export function createApp() {
  const app = new Hono<{ Bindings: Env; Variables: Vars }>()

  // ──────────────────────────────────────────────────────────────────────────
  // Middleware stack (order matters — SPEC_BACKEND.md)
  // trace-id → CORS → error envelope → (rate-limit) → (auth) → routes
  // ──────────────────────────────────────────────────────────────────────────

  app.use('*', async (c, next) => {
    const incoming = c.req.header('x-trace-id')
    const trace_id = incoming && /^[a-zA-Z0-9_-]{8,128}$/.test(incoming) ? incoming : crypto.randomUUID()
    c.set('trace_id', trace_id)
    c.header('x-trace-id', trace_id)
    await next()
  })

  app.use(
    '*',
    cors({
      origin: (origin, c) => {
        const allowed = c.env.APP_URL
        return origin === allowed ? origin : allowed
      },
      allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      allowHeaders: ['content-type', 'authorization', 'x-trace-id'],
      credentials: true,
      maxAge: 600,
    }),
  )

  app.onError((err, c) => {
    const trace_id = c.get('trace_id') ?? 'unknown'
    const maybeStatus = (err as unknown as { status?: number }).status
    const status = typeof maybeStatus === 'number' ? maybeStatus : 500
    return c.json(
      {
        ok: false,
        error: {
          code: status >= 500 ? 'internal' : 'bad_request',
          message: err.message ?? 'Unexpected error',
        },
        trace_id,
      },
      status as 400 | 401 | 403 | 404 | 500,
    )
  })

  app.notFound((c) =>
    c.json(
      { ok: false, error: { code: 'not_found', message: 'Route not found' }, trace_id: c.get('trace_id') ?? 'unknown' },
      404,
    ),
  )

  // Health — no auth, cheap, always on.
  app.get('/api/admin/health', (c) =>
    c.json({
      ok: true,
      data: {
        env: c.env.ENV,
        ts: Date.now(),
        region: (c.req.raw as Request & { cf?: { colo?: string } }).cf?.colo ?? null,
      },
      trace_id: c.get('trace_id')!,
    }),
  )

  // Authenticated identity probe.
  app.get('/api/me', authMiddleware, (c) => {
    const user = c.get('user')
    return c.json({ ok: true, data: { id: user.sub, email: user.email }, trace_id: c.get('trace_id') })
  })

  mountAuthRoutes(app)
  mountSessionRoutes(app)

  return app
}
