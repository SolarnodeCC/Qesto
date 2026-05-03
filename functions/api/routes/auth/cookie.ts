import { setCookie } from 'hono/cookie'
import type { Context } from 'hono'
import { SESSION_COOKIE } from '../../middleware/auth'
import { JWT_TTL_SECONDS } from './constants'

/**
 * Issue HttpOnly session cookie (production SSO / cross-site flows).
 * Options must stay aligned across magic-link, password, OAuth, and SAML.
 */
export function setAuthSessionCookie(c: Context, jwt: string): void {
  setCookie(c, SESSION_COOKIE, jwt, {
    httpOnly: true,
    secure: true,
    sameSite: 'None',
    path: '/',
    maxAge: JWT_TTL_SECONDS,
  })
}
