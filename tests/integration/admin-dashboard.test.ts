import { describe, it, expect, beforeEach } from 'vitest'
import { testHonoApp, cookieFor, TEST_SECRET, SEED_ADMIN_EMAIL } from './setup'

describe('Admin Routes — Phase 8 Step 2', () => {
  let app: any
  let env: any
  let adminCookie: string
  let nonAdminCookie: string

  beforeEach(async () => {
    const setup = await testHonoApp()
    app = setup.app
    env = setup.env
    // Admin: email matches SEED_ADMIN_EMAIL — bypasses user_roles DB lookup
    adminCookie = await cookieFor('user_123', SEED_ADMIN_EMAIL)
    // Non-admin: different email, no roles in DB → adminMiddleware rejects with 403
    nonAdminCookie = await cookieFor('user_456', 'other@example.com')
  })

  describe('GET /api/admin/metrics/live', () => {
    it('returns live metrics for authenticated admin', async () => {
      const res = await app.fetch(
        new Request('http://local/api/admin/metrics/live', {
          headers: { cookie: adminCookie, 'cf-connecting-ip': '127.0.0.1' },
        }),
        env,
      )

      expect(res.status).toBe(200)
      const body = (await res.json()) as { ok: boolean; data: { active_sessions: number } }
      expect(body.ok).toBe(true)
      expect(body.data).toHaveProperty('active_sessions')
      expect(body.data).toHaveProperty('refresh_ts')
    })

    it('returns 403 for non-admin user', async () => {
      const res = await app.fetch(
        new Request('http://local/api/admin/metrics/live', {
          headers: { cookie: nonAdminCookie, 'cf-connecting-ip': '127.0.0.1' },
        }),
        env,
      )

      expect(res.status).toBe(403)
      const body = (await res.json()) as { ok: boolean; error: { code: string } }
      expect(body.ok).toBe(false)
      expect(body.error.code).toBe('forbidden')
    })

    it('returns 401 for unauthenticated request', async () => {
      const res = await app.fetch(
        new Request('http://local/api/admin/metrics/live'),
        env,
      )

      expect(res.status).toBe(401)
    })

    it('returns response in under 200ms (p95)', async () => {
      const start = Date.now()
      const res = await app.fetch(
        new Request('http://local/api/admin/metrics/live', {
          headers: { cookie: adminCookie, 'cf-connecting-ip': '127.0.0.1' },
        }),
        env,
      )
      const elapsed = Date.now() - start

      expect(res.status).toBe(200)
      expect(elapsed).toBeLessThan(200)
    })
  })

  describe('GET /api/admin/metrics/historical', () => {
    it('returns historical metrics for date range', async () => {
      const start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const end = new Date().toISOString()
      const res = await app.fetch(
        new Request(`http://local/api/admin/metrics/historical?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`, {
          headers: { cookie: adminCookie, 'cf-connecting-ip': '127.0.0.1' },
        }),
        env,
      )

      expect(res.status).toBe(200)
      const body = (await res.json()) as { ok: boolean; data: Array<{ bucket_ts: number; p95_ms: number }> }
      expect(body.ok).toBe(true)
      expect(Array.isArray(body.data)).toBe(true)
    })

    it('returns response in under 1000ms (p95)', async () => {
      const start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const end = new Date().toISOString()
      const startTime = Date.now()
      const res = await app.fetch(
        new Request(`http://local/api/admin/metrics/historical?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`, {
          headers: { cookie: adminCookie, 'cf-connecting-ip': '127.0.0.1' },
        }),
        env,
      )
      const elapsed = Date.now() - startTime

      expect(res.status).toBe(200)
      expect(elapsed).toBeLessThan(1000)
    })
  })

  describe('POST /api/admin/metrics/export', () => {
    it('exports metrics as CSV', async () => {
      const start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const end = new Date().toISOString()
      const res = await app.fetch(
        new Request('http://local/api/admin/metrics/export', {
          method: 'POST',
          headers: { cookie: adminCookie, 'cf-connecting-ip': '127.0.0.1', 'Content-Type': 'application/json' },
          body: JSON.stringify({ start, end }),
        }),
        env,
      )

      expect(res.status).toBe(200)
      const text = await res.text()
      expect(text).toContain('bucket_ts')
      expect(text).toContain('route')
    })

    it('returns 403 for non-admin', async () => {
      const res = await app.fetch(
        new Request('http://local/api/admin/metrics/export', {
          method: 'POST',
          headers: { cookie: nonAdminCookie, 'cf-connecting-ip': '127.0.0.1', 'Content-Type': 'application/json' },
          body: JSON.stringify({ start: new Date().toISOString(), end: new Date().toISOString() }),
        }),
        env,
      )

      expect(res.status).toBe(403)
    })
  })
})
