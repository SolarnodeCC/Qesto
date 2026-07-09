import type { MiddlewareHandler } from 'hono'
import { getCookie } from 'hono/cookie'
import { jwtVerificationSecrets, verifyJwtWithSecrets, type AuthClaims } from '../lib/jwt'
import { hashSessionToken, revokedSessionTokenKey } from '../lib/session-token'
import { readKvText } from '../lib/kv'
import { isPublicApiPath } from '../lib/public-api-paths'
import { timingSafeEqual } from '../lib/shared/crypto'
import type { Env } from '../types'

/** ARCH-HONO-02 — session cookie not required on documented public prefixes (v1/v2 use API keys). */
const SESSION_AUTH_EXEMPT = [
  '/api/admin/health',
  '/api/version',
  '/api/marketplace/',
  '/api/partner/sla',
] as const

/** Marketing video preview streaming — the signed HMAC token IS the auth for this one route. */
function isVideoAssetStreamPath(pathname: string): boolean {
  return /^\/api\/marketing\/video-assets\/[^/]+\/stream$/.test(pathname)
}

function isSessionAuthExempt(pathname: string): boolean {
  if (SESSION_AUTH_EXEMPT.some((p) => pathname.startsWith(p))) return true
  if (isVideoAssetStreamPath(pathname)) return true
  return isPublicApiPath(pathname) && (pathname.startsWith('/api/v1/') || pathname.startsWith('/api/v2/'))
}

export const SESSION_COOKIE = 'qesto_session'
// Platformbeheer Module 3 — when present and valid, this HttpOnly cookie takes
// precedence over the real session so the admin's requests resolve as the
// impersonated user. The admin's own SESSION_COOKIE is left intact, so clearing
// this cookie ("stop impersonating") restores their session without re-login.
export const IMPERSONATION_COOKIE = 'qesto_impersonation'

export type AuthVariables = {
  trace_id: string
  user: AuthClaims
  session_token: string
  /** Set only while impersonating — the real admin acting behind the session. */
  impersonator_id?: string
}

export const authMiddleware: MiddlewareHandler<{ Bindings: Env; Variables: AuthVariables }> = async (c, next) => {
  // ARCH-HONO-01/02: registered app.use('*') on ~12 sub-apps mounted at /api, so
  // one request passes through auth many times. Once a prior pass has verified
  // the JWT and set `user` (always alongside `session_token`), re-verifying is
  // wasted CPU and yields the same result — short-circuit idempotently.
  if (c.get('user')) {
    await next()
    return
  }
  const pathname = new URL(c.req.url).pathname
  if (isSessionAuthExempt(pathname)) {
    await next()
    return
  }
  // Read-only KB semantic search additionally accepts a dedicated service key for
  // machine clients (the kb_search MCP tool used by dev agents). Path-scoped to
  // exactly /api/knowledge-base/search and gated on the KB_SEARCH_SERVICE_KEY
  // secret (constant-time compare); it authenticates that one read-only route and
  // nothing else. When the secret is unset, a JWT remains mandatory.
  if (pathname === '/api/knowledge-base/search') {
    const provided = c.req.header('x-kb-service-key')
    const expected = c.env.KB_SEARCH_SERVICE_KEY
    if (expected && provided && timingSafeEqual(provided, expected)) {
      await next()
      return
    }
  }
  const cookieToken = getCookie(c, SESSION_COOKIE)
  const authHeader = c.req.header('authorization')
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  // Impersonation cookie wins, but only if it is a well-formed impersonation
  // token (jti = `imp:<adminId>:<ulid>`). Anything else falls through to the
  // normal session, so a stale/garbage cookie can never lock an admin out.
  let impersonatorId: string | null = null
  let activeToken: string | null = null
  const impCookie = getCookie(c, IMPERSONATION_COOKIE)
  if (impCookie) {
    const impClaims = await verifyJwtWithSecrets(impCookie, jwtVerificationSecrets(c.env))
    if (impClaims && typeof impClaims.jti === 'string' && impClaims.jti.startsWith('imp:')) {
      activeToken = impCookie
      impersonatorId = impClaims.jti.split(':')[1] ?? null
    }
  }

  const token = activeToken ?? cookieToken ?? bearerToken
  if (!token) {
    return c.json(
      { ok: false, error: { code: 'unauthenticated', message: 'Missing session cookie' }, trace_id: c.get('trace_id') },
      401,
    )
  }
  const claims = await verifyJwtWithSecrets(token, jwtVerificationSecrets(c.env))
  if (!claims) {
    return c.json(
      { ok: false, error: { code: 'unauthenticated', message: 'Invalid or expired session' }, trace_id: c.get('trace_id') },
      401,
    )
  }
  if (c.env.ACTIONS_KV) {
    const tokenHash = await hashSessionToken(token)
    const revoked = await readKvText(c.env.ACTIONS_KV, revokedSessionTokenKey(tokenHash))
    if (revoked) {
      return c.json(
        { ok: false, error: { code: 'unauthenticated', message: 'Session has been revoked' }, trace_id: c.get('trace_id') },
        401,
      )
    }
  }
  c.set('user', claims)
  c.set('session_token', token)
  if (impersonatorId) c.set('impersonator_id', impersonatorId)
  await next()
}

/**
 * SEC — non-rejecting authentication pass.
 *
 * Populates `user`/`session_token` (and `impersonator_id`) whenever a valid,
 * non-revoked session token is present, and otherwise falls through untouched.
 * It NEVER returns 401.
 *
 * This exists to fix a middleware-ordering defect: `rbacMiddleware` is registered
 * at the parent `/api/*` scope, but the strict `authMiddleware` only runs inside
 * the feature sub-apps mounted afterwards. Without this pass, RBAC always executed
 * before any auth ran, saw no `user`, and short-circuited to `canAccess: true` —
 * silently disabling the permission matrix in production. Registering this pass
 * immediately before `rbacMiddleware` lets RBAC see the authenticated principal
 * and enforce roles. The strict `authMiddleware` mounted inside each sub-app
 * remains the control that rejects unauthenticated access (this pass is additive,
 * not a replacement). It is idempotent — a subsequent `authMiddleware` pass
 * short-circuits once `user` is set, so the JWT is verified once per request.
 */
export const softAuthMiddleware: MiddlewareHandler<{ Bindings: Env; Variables: AuthVariables }> = async (c, next) => {
  if (c.get('user')) {
    await next()
    return
  }

  let impersonatorId: string | null = null
  let activeToken: string | null = null
  const impCookie = getCookie(c, IMPERSONATION_COOKIE)
  if (impCookie) {
    const impClaims = await verifyJwtWithSecrets(impCookie, jwtVerificationSecrets(c.env))
    if (impClaims && typeof impClaims.jti === 'string' && impClaims.jti.startsWith('imp:')) {
      activeToken = impCookie
      impersonatorId = impClaims.jti.split(':')[1] ?? null
    }
  }

  const authHeader = c.req.header('authorization')
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  const token = activeToken ?? getCookie(c, SESSION_COOKIE) ?? bearerToken
  if (!token) {
    await next()
    return
  }
  const claims = await verifyJwtWithSecrets(token, jwtVerificationSecrets(c.env))
  if (!claims) {
    await next()
    return
  }
  if (c.env.ACTIONS_KV) {
    const tokenHash = await hashSessionToken(token)
    const revoked = await readKvText(c.env.ACTIONS_KV, revokedSessionTokenKey(tokenHash))
    if (revoked) {
      await next()
      return
    }
  }
  c.set('user', claims)
  c.set('session_token', token)
  if (impersonatorId) c.set('impersonator_id', impersonatorId)
  await next()
}
