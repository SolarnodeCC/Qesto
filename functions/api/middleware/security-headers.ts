/**
 * Security response headers (Sprint 49 hardening).
 */
import type { MiddlewareHandler } from 'hono'
import type { Env } from '../types'

export const securityHeadersMiddleware: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  await next()
  c.header('X-Content-Type-Options', 'nosniff')
  c.header('X-Frame-Options', 'DENY')
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin')
  c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  // #533: HSTS protects the session cookie (SameSite=None) against downgrade /
  // MITM on the API origin and sibling subdomains. 2 years + preload-eligible.
  c.header('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload')
  // #533: the API only ever returns JSON, redirects, XML metadata, or downloaded
  // attachments — never framed/rendered HTML in our origin — so the strictest
  // possible policy applies. The SPA's own (necessarily looser) CSP lives in
  // public/_headers. `default-src 'none'` means any future accidental inline
  // script in an API response is blocked by default.
  c.header(
    'Content-Security-Policy',
    "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
  )
}
