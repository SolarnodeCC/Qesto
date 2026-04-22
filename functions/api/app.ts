import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { mountAuthRoutes } from './routes/auth'
import { mountSessionRoutes } from './routes/sessions'
import { mountBillingRoutes } from './routes/billing'
import { mountInsightsRoutes } from './routes/insights'
import { mountAdminRoutes } from './routes/admin'
import { mountEnergizerRoutes } from './routes/energizers'
import { mountGamificationRoutes } from './routes/gamification'
import { mountAIInsightsRoutes } from './routes/ai-insights'
import { mountTemplateRoutes } from './routes/templates'
import { mountTeamRoutes } from './routes/teams'
import { authMiddleware, type AuthVariables } from './middleware/auth'
import { csrfMiddleware } from './middleware/csrf'
import type { PlanVariables } from './middleware/plan'
import type { AdminVariables } from './middleware/admin'
import { rbacMiddleware, type RbacVariables } from './middleware/rbac'
import { loggerMiddleware } from './middleware/logger'
import { rateLimit } from './middleware/rate-limit'
import type { Env } from './types'

type Vars = AuthVariables & PlanVariables & Partial<AdminVariables> & Partial<RbacVariables>

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
    c.header('x-qesto-api-commit', c.env.COMMIT_SHA ?? 'unknown')
    await next()
  })

  app.use(
    '*',
    cors({
      origin: (origin, c) => {
        const allowed = c.env.PAGES_URL
        if (!origin) return null
        if (origin === allowed) return origin
        // Allow Cloudflare Pages preview deployments (<hash>.qesto.pages.dev).
        if (/^https:\/\/[a-z0-9]+\.qesto\.pages\.dev$/.test(origin)) return origin
        // Allow localhost in dev (Vite dev server).
        if (c.env.ENV === 'dev' && origin.startsWith('http://localhost:')) return origin
        return null
      },
      allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      allowHeaders: ['content-type', 'authorization', 'x-trace-id', 'idempotency-key'],
      credentials: true,
      maxAge: 600,
    }),
  )

  // Structured JSON log line per request (silent in dev).
  app.use('*', loggerMiddleware)

  // CSRF defense-in-depth: reject cross-origin state-changing requests. Runs
  // AFTER the CORS handler so the CORS response for OPTIONS preflight is
  // preserved, and BEFORE auth so attacker requests never touch route logic.
  app.use('*', csrfMiddleware)

  // Per-route rate limits (KV-backed, fail-open).
  app.use('/api/auth/request', rateLimit<Vars>({ namespace: 'auth', limit: 5, windowSec: 600 }))
  app.use('/api/sessions', async (c, next) => {
    if (c.req.method === 'POST') {
      return rateLimit<Vars>({ namespace: 'session-create', limit: 30, windowSec: 3600 })(c, next)
    }
    await next()
  })
  app.use('/api/sessions/by-code/:code', rateLimit<Vars>({ namespace: 'join', limit: 20, windowSec: 60 }))

  // RBAC enforcement — role-based access control for all API routes (Phase 8).
  // Checks user roles against permission matrix; defaults to viewer if no explicit role.
  app.use('/api/*', rbacMiddleware)

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

  // Public deploy/version probe for parity checks.
  app.get('/api/version', (c) =>
    c.json({
      ok: true,
      data: {
        env: c.env.ENV,
        commit: c.env.COMMIT_SHA ?? 'unknown',
      },
      trace_id: c.get('trace_id')!,
    }),
  )

  // Health — no auth, cheap, always on.
  app.get('/api/admin/health', (c) =>
    c.json({
      ok: true,
      data: {
        env: c.env.ENV,
        ts: Date.now(),
        region: (c.req.raw as Request & { cf?: { colo?: string } }).cf?.colo ?? null,
        commit: c.env.COMMIT_SHA ?? 'unknown',
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
  mountTemplateRoutes(app)
  mountTeamRoutes(app)
  mountBillingRoutes(app)
  mountInsightsRoutes(app)
  mountAdminRoutes(app)
  mountEnergizerRoutes(app)
  mountGamificationRoutes(app)
  mountAIInsightsRoutes(app)

  return app
}
