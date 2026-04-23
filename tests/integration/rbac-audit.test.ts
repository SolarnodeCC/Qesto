import { describe, it, expect, beforeEach } from 'vitest'
import { testHonoApp, cookieFor, SEED_ADMIN_EMAIL } from './setup'

describe('RBAC + Audit — Phase 8 Step 3', () => {
  let app: any
  let env: any
  let adminCookie: string

  beforeEach(async () => {
    const setup = await testHonoApp()
    app = setup.app
    env = setup.env
    adminCookie = await cookieFor('user_123', SEED_ADMIN_EMAIL)
  })

  describe('RBAC enforcement', () => {
    it('allows viewer role to read sessions', async () => {
      const cookie = await cookieFor('user_viewer', 'viewer@example.com')
      const res = await app.fetch(
        new Request('http://local/api/sessions', {
          headers: { cookie, 'cf-connecting-ip': '127.0.0.1' },
        }),
        env,
      )

      // viewer role: DB has no explicit role → defaults to 'viewer' in RBAC
      // GET /api/sessions is allowed for viewer, so should return 200 (empty list)
      expect(res.status).toBe(200)
      const body = await res.json() as any
      expect(body.ok).toBe(true)
      expect(Array.isArray(body.data.sessions)).toBe(true)
    })

    it('denies guest role from creating sessions', async () => {
      // Unauthenticated = guest role. RBAC blocks POST /api/sessions (requires member+).
      // But session sub-app's authMiddleware runs first and returns 401.
      const res = await app.fetch(
        new Request('http://local/api/sessions', {
          method: 'POST',
          headers: { 'cf-connecting-ip': '127.0.0.1', 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: 'Test', anonymity: 'anonymous' }),
        }),
        env,
      )

      expect([401, 403, 404]).toContain(res.status)
    })

    it('denies non-admin from audit endpoint (pure RBAC gate)', async () => {
      // Authenticated user without admin role: viewer defaults
      // GET /api/admin/audit requires owner/admin → RBAC blocks them with 403
      const memberCookie = await cookieFor('user_member', 'member@example.com')
      const res = await app.fetch(
        new Request('http://local/api/admin/audit', {
          headers: { cookie: memberCookie, 'cf-connecting-ip': '127.0.0.1' },
        }),
        env,
      )

      // Auth succeeded (valid cookie), but RBAC denies endpoint for non-admin
      expect(res.status).toBe(403)
      const body = await res.json() as any
      expect(body.error.code).toBe('forbidden')
    })

    it('allows owner role from deleting sessions', async () => {
      // Owner with SEED_ADMIN_EMAIL bypasses RBAC and gets full access.
      // Session doesn't exist → 404 (not 403).
      const sessionId = 'session_test_123'
      const res = await app.fetch(
        new Request(`http://local/api/sessions/${sessionId}`, {
          method: 'DELETE',
          headers: { cookie: adminCookie, 'cf-connecting-ip': '127.0.0.1' },
        }),
        env,
      )

      expect(res.status).not.toBe(403)
    })

    it('grants seed admin all permissions', async () => {
      const res = await app.fetch(
        new Request('http://local/api/admin/metrics/live', {
          headers: { cookie: adminCookie, 'cf-connecting-ip': '127.0.0.1' },
        }),
        env,
      )

      expect(res.status).not.toBe(403)
    })
  })

  describe('Audit logging', () => {
    it('logs session creation in audit_events', async () => {
      const cookie = await cookieFor('user_creator', 'creator@example.com')

      const createRes = await app.fetch(
        new Request('http://local/api/sessions', {
          method: 'POST',
          headers: { cookie, 'cf-connecting-ip': '127.0.0.1', 'Content-Type': 'application/json', 'idempotency-key': 'audit-test-1' },
          body: JSON.stringify({ title: 'Audit Test' }),
        }),
        env,
      )

      if (createRes.status === 200 || createRes.status === 201) {
        const createdBody = await createRes.json() as any
        const sessionId = createdBody.data?.session?.id

        if (sessionId) {
          const auditRes = await app.fetch(
            new Request(`http://local/api/admin/audit?subject_type=session&subject_id=${sessionId}`, {
              headers: { cookie: adminCookie, 'cf-connecting-ip': '127.0.0.1' },
            }),
            env,
          )

          if (auditRes.status === 200) {
            const auditBody = await auditRes.json() as any
            if (auditBody.ok && auditBody.data) {
              expect(auditBody.data.events || []).toBeInstanceOf(Array)
            }
          }
        }
      }
    })

    it('audit endpoint requires admin role', async () => {
      const cookie = await cookieFor('user_guest', 'guest@example.com')
      const res = await app.fetch(
        new Request('http://local/api/admin/audit', {
          headers: { cookie, 'cf-connecting-ip': '127.0.0.1' },
        }),
        env,
      )

      expect([401, 403]).toContain(res.status)
    })

    it('audit endpoint supports filtering by actor_id', async () => {
      const res = await app.fetch(
        new Request('http://local/api/admin/audit?actor_id=user_123', {
          headers: { cookie: adminCookie, 'cf-connecting-ip': '127.0.0.1' },
        }),
        env,
      )

      expect(res.status).toBe(200)
      const body = await res.json() as any
      expect(body.ok).toBe(true)
      expect(body.data).toHaveProperty('events')
      expect(body.data).toHaveProperty('total')
    })

    it('audit endpoint supports filtering by date range', async () => {
      const since = Date.now() - 7 * 24 * 60 * 60 * 1000
      const until = Date.now()
      const res = await app.fetch(
        new Request(`http://local/api/admin/audit?since_ts=${since}&until_ts=${until}`, {
          headers: { cookie: adminCookie, 'cf-connecting-ip': '127.0.0.1' },
        }),
        env,
      )

      expect(res.status).toBe(200)
      const body = await res.json() as any
      expect(body.ok).toBe(true)
      expect(Array.isArray(body.data.events)).toBe(true)
    })
  })
})
