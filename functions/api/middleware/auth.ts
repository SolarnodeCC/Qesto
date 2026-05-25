import type { MiddlewareHandler } from 'hono'
import { getCookie } from 'hono/cookie'
import { verifyJwt, type AuthClaims } from '../lib/jwt'
import { hashSessionToken, revokedSessionTokenKey } from '../lib/session-token'
import { isPublicApiPath } from '../lib/public-api-paths'
import type { Env } from '../types'

/** ARCH-HONO-02 — session cookie not required on documented public prefixes (v1/v2 use API keys). */
const SESSION_AUTH_EXEMPT = [
  '/api/admin/health',
  '/api/version',
  '/api/marketplace/',
  '/api/partner/sla',
] as const

function isSessionAuthExempt(pathname: string): boolean {
  if (SESSION_AUTH_EXEMPT.some((p) => pathname.startsWith(p))) return true
  return isPublicApiPath(pathname) && (pathname.startsWith('/api/v1/') || pathname.startsWith('/api/v2/'))
}

export const SESSION_COOKIE = 'qesto_session'

export type AuthVariables = {
  trace_id: string
  user: AuthClaims
  session_token: string
}

export const authMiddleware: MiddlewareHandler<{ Bindings: Env; Variables: AuthVariables }> = async (c, next) => {
  const pathname = new URL(c.req.url).pathname
  if (isSessionAuthExempt(pathname)) {
    await next()
    return
  }
  const cookieToken = getCookie(c, SESSION_COOKIE)
  const authHeader = c.req.header('authorization')
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  const token = cookieToken ?? bearerToken
  if (!token) {
    return c.json(
      { ok: false, error: { code: 'unauthenticated', message: 'Missing session cookie' }, trace_id: c.get('trace_id') },
      401,
    )
  }
  const claims = await verifyJwt(token, c.env.JWT_SECRET)
  if (!claims) {
    return c.json(
      { ok: false, error: { code: 'unauthenticated', message: 'Invalid or expired session' }, trace_id: c.get('trace_id') },
      401,
    )
  }
  if (c.env.ACTIONS_KV) {
    const tokenHash = await hashSessionToken(token)
    const revoked = await c.env.ACTIONS_KV.get(revokedSessionTokenKey(tokenHash))
    if (revoked) {
      return c.json(
        { ok: false, error: { code: 'unauthenticated', message: 'Session has been revoked' }, trace_id: c.get('trace_id') },
        401,
      )
    }
  }
  c.set('user', claims)
  c.set('session_token', token)
  await next()
}
