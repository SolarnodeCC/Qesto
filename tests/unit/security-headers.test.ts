// #533 — every API response must carry the baseline security headers, including
// HSTS and a strict Content-Security-Policy. (The SPA's looser CSP lives in
// public/_headers; this covers the API worker origin.)

import { describe, expect, it } from 'vitest'
import { Hono } from 'hono'
import { securityHeadersMiddleware } from '../../functions/api/middleware/security-headers'

function appWithHeaders() {
  const app = new Hono()
  app.use('*', securityHeadersMiddleware)
  app.get('/json', (c) => c.json({ ok: true }))
  return app
}

describe('securityHeadersMiddleware (#533)', () => {
  it('sets HSTS with a long max-age, includeSubDomains and preload', async () => {
    const res = await appWithHeaders().request('/json')
    const hsts = res.headers.get('Strict-Transport-Security')
    expect(hsts).toBeTruthy()
    expect(hsts).toContain('includeSubDomains')
    expect(hsts).toContain('preload')
    const maxAge = Number(/max-age=(\d+)/.exec(hsts ?? '')?.[1] ?? '0')
    expect(maxAge).toBeGreaterThanOrEqual(31536000) // >= 1 year
  })

  it('sets a strict Content-Security-Policy that blocks framing and scripts by default', async () => {
    const res = await appWithHeaders().request('/json')
    const csp = res.headers.get('Content-Security-Policy')
    expect(csp).toBeTruthy()
    expect(csp).toContain("default-src 'none'")
    expect(csp).toContain("frame-ancestors 'none'")
  })

  it('keeps the existing baseline headers', async () => {
    const res = await appWithHeaders().request('/json')
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(res.headers.get('X-Frame-Options')).toBe('DENY')
    expect(res.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin')
    expect(res.headers.get('Permissions-Policy')).toContain('camera=()')
  })
})
