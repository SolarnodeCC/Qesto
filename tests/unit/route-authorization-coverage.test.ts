/**
 * Requirement: issues #880 (DD-07) and #894 (DD-22) — middleware ORDER carries
 * security meaning in createApp(), and only in-route checks authorize. This
 * test makes that checkable instead of conventional: it enumerates EVERY
 * registered route and asserts an unauthenticated request is rejected with
 * 401/403, unless the route is on the explicit PUBLIC_ROUTES allowlist below.
 *
 * Adding a public route? Add it here with the reason it needs no session, in
 * the same PR — a reviewer then sees the exposure decision explicitly.
 */
import { describe, expect, it } from 'vitest'
import { createApp } from '../../functions/api/app'
import type { Env } from '../../functions/api/types'
import { D1Mock } from '../helpers/d1-mock'
import { KVMock } from '../helpers/kv-mock'

const PUBLIC_ROUTES: Record<string, string> = {
  // Auth entry points — by definition reachable without a session.
  'POST /api/auth/request': 'magic-link request',
  'GET /api/auth/callback': 'magic-link landing',
  'GET /api/auth/google': 'OAuth start',
  'GET /api/auth/google/callback': 'OAuth callback',
  'POST /api/auth/password/login': 'password login',
  'POST /api/auth/password/signup': 'password signup',
  'POST /api/auth/password/reset-request': 'password reset request',
  'POST /api/auth/password/reset-confirm': 'password reset confirm (single-use token)',
  'POST /api/auth/logout': 'idempotent; revokes whatever tokens are presented',
  'POST /api/auth/mfa/verify': 'second login step; authenticated by the short-lived MFA pending token (DD-04)',
  'GET /api/auth/saml/init': 'SAML SP (kill-switched, DD-39)',
  'GET /api/auth/saml/metadata': 'SAML SP metadata (kill-switched, DD-39)',
  'POST /api/auth/saml/callback': 'SAML ACS (kill-switched, DD-39)',
  // Participant plane — anonymous by product design.
  'GET /api/sessions/by-code/:code': 'participant join by code',
  'GET /api/sessions/:id/ws': 'WebSocket upgrade; DO authenticates participants',
  'GET /api/events/:code/agenda': 'public event agenda by code',
  'GET /api/events/:code/feed': 'public event feed by code',
  'POST /api/report-content': 'abuse reporting must not require an account',
  // Token- or signature-authenticated machine planes.
  'GET /api/embed/v1/sessions/:idOrCode/results': 'embed widget token (ADR-0050)',
  'GET /api/embed/v1/sessions/:idOrCode/state': 'embed widget token (ADR-0050)',
  'POST /api/embed/v1/handshake': 'embed widget token (ADR-0050)',
  'POST /api/billing/webhook/stripe': 'Stripe signature',
  'GET /api/admin/health': 'ops probe with its own service key',
  // Public marketing / catalogue / discovery content.
  'GET /api/plans/catalog': 'pricing page',
  'GET /api/templates': 'public template library',
  'GET /api/templates/:id': 'public template',
  'GET /api/gallery': 'public template gallery',
  'GET /api/gallery/:id': 'public template',
  'POST /api/gallery/:id/use': 'email-gated, rate-limited template trial',
  'GET /api/marketplace/apps': 'public marketplace listing',
  'GET /api/og': 'Open Graph image renderer',
  'GET /api/teams/resolve-domain': 'custom-domain → team branding lookup',
  'GET /api/developer/docs': 'developer portal',
  'GET /api/developer/openapi.json': 'public API contract',
  'GET /api/developer/portal': 'developer portal',
  'GET /api/partner/sla': 'published SLA',
  'GET /api/version': 'deploy probe (DD-08 commit parity)',
  'GET /api/platform/certification': 'public trust page data',
  'GET /api/platform/dr-readiness': 'public trust page data',
  'GET /api/platform/fedramp-path': 'public trust page data',
  'GET /api/platform/migration/v3': 'public API migration notes',
  'GET /api/platform/regions': 'public trust page data',
  'GET /api/platform/releases': 'public changelog',
  'GET /api/platform/scale-proof': 'public trust page data',
  'GET /api/platform/v4-sunset': 'public API sunset notice',
  'GET /api/platform/v5-sunset': 'public API sunset notice',
  'GET /api/platform/v6-sunset': 'public API sunset notice',
  'GET /api/platform/version': 'public API version',
  // SEO / crawler files.
  'GET /sitemap-index.xml': 'sitemap',
  'GET /sitemap-templates.xml': 'sitemap',
  'GET /.well-known/indexnow': 'IndexNow key',
  'GET /indexnow.txt': 'IndexNow key',
  'GET /:keyFile.txt': 'IndexNow key file',
}

function makeEnv(): Env {
  const kv = () => new KVMock() as unknown as KVNamespace
  return {
    ENV: 'production',
    PAGES_URL: 'http://local',
    API_URL: 'http://local',
    // jankurai:allow HLT-010-SECRET-SPRAWL reason="local HMAC key for test-only JWTs, never used outside this suite" expires=2027-12-31
    JWT_SECRET: 'route-coverage-secret-at-least-32-bytes!',
    DB: new D1Mock() as unknown as D1Database,
    USERS_KV: kv(),
    SESSIONS_KV: kv(),
    TEAMS_KV: kv(),
    TEMPLATES_KV: kv(),
    DECISIONS_KV: kv(),
    AUDIT_KV: kv(),
    ACTIONS_KV: kv(),
    METRICS_KV: kv(),
    INTEGRATIONS_KV: kv(),
    HELP_CONVERSATIONS_KV: kv(),
    MARKETING_KV: kv(),
    CIRCUIT_BREAKER_KV: kv(),
    MULTI_REGION_STATE_KV: kv(),
    LINKEDIN_KV: kv(),
  } as unknown as Env
}

const executionCtx = { waitUntil() {}, passThroughOnException() {}, props: {} } as unknown as ExecutionContext

function enumerateRoutes(): Array<{ method: string; path: string }> {
  const seen = new Set<string>()
  const out: Array<{ method: string; path: string }> = []
  for (const r of createApp().routes) {
    if (r.method === 'ALL') continue // middleware registrations, not endpoints
    const key = `${r.method} ${r.path}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ method: r.method, path: r.path })
  }
  return out
}

const ROUTES = enumerateRoutes()

describe('route authorization coverage (DD-07 / DD-22)', () => {
  it('enumerates a realistic route table', () => {
    expect(ROUTES.length).toBeGreaterThan(300)
  })

  it('every PUBLIC_ROUTES entry still exists (no stale exemptions)', () => {
    const keys = new Set(ROUTES.map((r) => `${r.method} ${r.path}`))
    const stale = Object.keys(PUBLIC_ROUTES).filter((k) => !keys.has(k))
    expect(stale).toEqual([])
  })

  it('every non-public route rejects an unauthenticated request with 401/403', async () => {
    const app = createApp()
    const env = makeEnv()
    const offenders: string[] = []
    for (const { method, path } of ROUTES) {
      const key = `${method} ${path}`
      if (PUBLIC_ROUTES[key]) continue
      const concrete = path.replace(/:[A-Za-z_]+(\{[^}]*\})?/g, 'x1').replace(/\*/g, 'x1')
      const res = await app.fetch(
        new Request(`http://local${concrete}`, {
          method,
          headers: { 'content-type': 'application/json', origin: 'http://local', 'cf-connecting-ip': '203.0.113.9' },
          ...(method === 'GET' || method === 'HEAD' ? {} : { body: '{}' }),
        }),
        env,
        executionCtx,
      )
      if (res.status !== 401 && res.status !== 403) offenders.push(`${res.status} ${key}`)
    }
    expect(offenders).toEqual([])
  }, 60_000)
})
