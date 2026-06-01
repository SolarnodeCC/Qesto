import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import { deprecationHeaders } from '../../functions/api/lib/deprecation'

function makeApp(sunset: string, successor: string) {
  const app = new Hono()
  app.use('*', deprecationHeaders({ sunset, successor }))
  app.get('/probe', (c) => c.json({ ok: true }))
  return app
}

describe('deprecationHeaders', () => {
  const sunset = 'Thu, 31 Dec 2026 23:59:59 GMT'
  const successor = '/api/v3'

  it('sets RFC 8594 Deprecation and Sunset headers on responses', async () => {
    const res = await makeApp(sunset, successor).request('/probe')
    expect(res.status).toBe(200)
    expect(res.headers.get('Deprecation')).toBe('true')
    expect(res.headers.get('Sunset')).toBe(sunset)
  })

  it('advertises the successor version via a Link header', async () => {
    const res = await makeApp(sunset, successor).request('/probe')
    expect(res.headers.get('Link')).toBe('</api/v3>; rel="successor-version"')
  })

  it('does not alter the response body', async () => {
    const res = await makeApp(sunset, successor).request('/probe')
    await expect(res.json()).resolves.toEqual({ ok: true })
  })
})
