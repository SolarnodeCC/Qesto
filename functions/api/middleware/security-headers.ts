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
}
