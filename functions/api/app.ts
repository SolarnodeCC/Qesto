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
import { mountHelpRoutes } from './routes/help'
import { mountUserRoutes } from './routes/users'
import { mountKnowledgeBaseRoutes } from './routes/knowledge-base'
import { registerKBRoutes } from './routes/kb-search'
import { mountIntegrationRoutes } from './routes/integrations'
import { mountGdprRoutes } from './routes/gdpr'
import { mountTournamentRoutes } from './routes/tournaments'
import { mountLdapRoutes } from './routes/ldap'
import { mountOrganizationRoutes } from './routes/organizations'
import { mountAgentGroundingRoutes } from './routes/agent-grounding'
import { mountApiKeyRoutes } from './routes/api-keys'
import { mountPublicApiV1Routes } from './routes/public-api-v1'
import { mountPublicApiV2Routes } from './routes/public-api-v2'
import { mountMultiRegionAdminRoutes } from './routes/multi-region-admin'
import { mountWebhookTemplateRoutes } from './routes/webhook-templates'
import { mountWebhookRoutes } from './routes/webhooks'
import { mountMarketingWebhookRoutes } from './routes/webhooks-marketing'
import { mountMarketingTemplateRoutes } from './routes/templates-marketing'
import { authMiddleware, type AuthVariables } from './middleware/auth'
import { csrfMiddleware } from './middleware/csrf'
import type { PlanVariables } from './middleware/plan'
import type { AdminVariables } from './middleware/admin'
import { rbacMiddleware, type RbacVariables } from './middleware/rbac'
import { loggerMiddleware } from './middleware/logger'
import { rateLimit } from './middleware/rate-limit'
import { writeEvent } from './lib/observability'
import { parseTraceHeaders } from './lib/distributed-trace'
import { securityHeadersMiddleware } from './middleware/security-headers'
import { sanitizeError } from './lib/error-handler'
import { resolveExpectedOrigin } from './lib/origin'
import { initCircuitBreakers } from './lib/resilience/circuit-breaker'
import { getMultiRegionConfig, resolveReadRegion } from './lib/multi-region'
import type { Env } from './types'

type Vars = AuthVariables & PlanVariables & Partial<AdminVariables> & Partial<RbacVariables> & {
  parent_trace_id?: string
}

export function createApp() {
  const app = new Hono<{ Bindings: Env; Variables: Vars }>()

  // ──────────────────────────────────────────────────────────────────────────
  // Middleware stack (order matters — SPEC_BACKEND.md)
  // trace-id → CORS → error envelope → (rate-limit) → (auth) → routes
  // ──────────────────────────────────────────────────────────────────────────

  app.use('*', async (c, next) => {
    const { trace_id, parent_trace_id } = parseTraceHeaders((name) => c.req.header(name))
    c.set('trace_id', trace_id)
    if (parent_trace_id) {
      c.set('parent_trace_id', parent_trace_id)
      c.header('x-parent-trace-id', parent_trace_id)
    }
    c.header('x-trace-id', trace_id)
    c.header('x-qesto-api-commit', c.env.COMMIT_SHA ?? 'unknown')
    // Wire circuit breakers with KV — idempotent, runs once per isolate.
    const cbKv =
      c.env.CIRCUIT_BREAKER_ENABLED === 'true' && c.env.CIRCUIT_BREAKER_KV
        ? c.env.CIRCUIT_BREAKER_KV
        : c.env.ACTIONS_KV
    initCircuitBreakers(cbKv, c.env.ENV ?? 'production')
    await next()
  })

  app.use(
    '*',
    cors({
      origin: (origin, c) => {
        const allowed = resolveExpectedOrigin(c.env, c.req.url)
        if (!origin) return null
        if (origin === allowed) return origin
        // Allow Cloudflare Pages preview deployments (<hash>.qesto.pages.dev).
        if (/^https:\/\/[a-z0-9]+\.qesto\.pages\.dev$/.test(origin)) return origin
        // Allow localhost in dev (Vite dev server).
        if (c.env.ENV === 'dev' && origin.startsWith('http://localhost:')) return origin
        return null
      },
      allowMethods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
      allowHeaders: ['content-type', 'authorization', 'x-trace-id', 'x-parent-trace-id', 'idempotency-key'],
      credentials: true,
      maxAge: 600,
    }),
  )

  app.use('*', securityHeadersMiddleware)

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

  mountPublicApiV1Routes(app)
  mountPublicApiV2Routes(app)

  // RBAC enforcement — role-based access control for all API routes (Phase 8).
  // Checks user roles against permission matrix; defaults to viewer if no explicit role.
  app.use('/api/*', rbacMiddleware)

  app.onError((err, c) => {
    const trace_id = c.get('trace_id') ?? 'unknown'
    const maybeStatus = (err as unknown as { status?: number }).status
    const status = typeof maybeStatus === 'number' ? maybeStatus : 500
    // Fire analytics event for 5xx errors only; 4xx client errors are noise.
    if (status >= 500) {
      writeEvent(c.env.METRICS_AE, {
        name: 'error.api',
        traceId: trace_id,
      })
    }
    const sanitized = sanitizeError(err, c.env.ENV, status)
    const code = status === 401
      ? 'unauthenticated'
      : status === 403
        ? 'forbidden'
        : status === 404
          ? 'not_found'
          : status === 409
            ? 'conflict'
            : status === 429
              ? 'rate_limited'
              : sanitized.code
    return c.json(
      {
        ok: false,
        error: {
          code,
          message: sanitized.message,
        },
        trace_id,
      },
      status as 400 | 401 | 403 | 404 | 409 | 429 | 500 | 502 | 503,
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
        commit: c.env.COMMIT_SHA ?? c.env.CF_PAGES_COMMIT_SHA ?? 'unknown',
      },
      trace_id: c.get('trace_id')!,
    }),
  )

  // Health — no auth, cheap, always on.
  app.get('/api/admin/health', (c) => {
    const colo = (c.req.raw as Request & { cf?: { colo?: string } }).cf?.colo ?? null
    const mr = getMultiRegionConfig(c.env)
    return c.json({
      ok: true,
      data: {
        env: c.env.ENV,
        ts: Date.now(),
        region: colo,
        readRegion: resolveReadRegion(colo, mr),
        multiRegion: mr,
        commit: c.env.COMMIT_SHA ?? c.env.CF_PAGES_COMMIT_SHA ?? 'unknown',
      },
      trace_id: c.get('trace_id')!,
    })
  })

  // Authenticated identity probe.
  app.get('/api/me', authMiddleware, (c) => {
    const user = c.get('user')
    return c.json({ ok: true, data: { id: user.sub, email: user.email }, trace_id: c.get('trace_id') })
  })

  // ── Route mount order matters (Hono v4) ────────────────────────────────────
  // Several sub-apps call app.use('*', authMiddleware) internally and mount at
  // the /api root. In Hono v4, middleware is evaluated in registration order:
  // routes registered AFTER a wildcard auth entry inherit it; routes registered
  // BEFORE are unaffected. PUBLIC routes must be mounted before the first
  // auth-middleware sub-app (mountEnergizerRoutes). See ARCH-HONO-01/02 in
  // BACKLOG_MASTER.md for the planned structural fix.
  // ──────────────────────────────────────────────────────────────────────────
  mountAuthRoutes(app)
  mountSessionRoutes(app)
  mountTemplateRoutes(app)
  // ↓ PUBLIC routes — must stay above the auth-middleware sub-apps below
  mountMarketingTemplateRoutes(app)
  mountMarketingWebhookRoutes(app)
  // ↓ Auth-middleware sub-apps — inject app.use('*', authMiddleware) at /api/*
  mountTeamRoutes(app)
  mountBillingRoutes(app)
  mountInsightsRoutes(app)
  mountAdminRoutes(app)
  mountMultiRegionAdminRoutes(app)
  mountEnergizerRoutes(app)
  mountGamificationRoutes(app)
  mountAIInsightsRoutes(app)
  mountHelpRoutes(app)
  mountUserRoutes(app)
  mountGdprRoutes(app)
  mountKnowledgeBaseRoutes(app)
  registerKBRoutes(app)
  mountIntegrationRoutes(app)
  mountWebhookRoutes(app)
  mountWebhookTemplateRoutes(app)
  mountTournamentRoutes(app)
  mountLdapRoutes(app)
  mountOrganizationRoutes(app)
  mountApiKeyRoutes(app)
  mountAgentGroundingRoutes(app)

  return app
}
