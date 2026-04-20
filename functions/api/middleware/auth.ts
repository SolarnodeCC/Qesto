import type { MiddlewareHandler } from 'hono'
import { getCookie } from 'hono/cookie'
import { verifyJwt, type AuthClaims } from '../lib/jwt'
import type { Env } from '../types'

export const SESSION_COOKIE = 'qesto_session'

export type AuthVariables = {
  trace_id: string
  user: AuthClaims
}

export const authMiddleware: MiddlewareHandler<{ Bindings: Env; Variables: AuthVariables }> = async (c, next) => {
  const token = getCookie(c, SESSION_COOKIE)
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
  c.set('user', claims)
  await next()
}
