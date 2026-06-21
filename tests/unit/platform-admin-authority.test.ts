import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import { adminMiddleware } from '../../functions/api/middleware/admin'
import { rbacMiddleware } from '../../functions/api/middleware/rbac'
import type { Env } from '../../functions/api/types'

// #586 (CRITICAL) — team 'owner' rows in user_roles must NOT confer platform-admin.
// Platform authority lives in platform_roles (or the env allowlist).

/**
 * Minimal D1 fake. `userRoles` / `platformRoles` are sets of `${userId}:${role}`.
 */
function makeDb(opts: { userRoles?: Set<string>; platformRoles?: Set<string> }) {
  const userRoles = opts.userRoles ?? new Set<string>()
  const platformRoles = opts.platformRoles ?? new Set<string>()

  function prepare(sql: string) {
    const s = sql.trim().replace(/\s+/g, ' ')
    let bound: unknown[] = []
    const api = {
      bind(...args: unknown[]) {
        bound = args
        return api
      },
      async first<T>(): Promise<T | null> {
        // adminMiddleware: SELECT role FROM platform_roles WHERE user_id = ?1 AND role = ?2
        if (s.startsWith('SELECT role FROM platform_roles')) {
          return platformRoles.has(`${bound[0]}:${bound[1]}`) ? ({ role: bound[1] } as T) : null
        }
        // rbac hasPlatformAdmin: SELECT 1 AS ok FROM platform_roles ...
        if (s.includes('FROM platform_roles') && s.includes('AS ok')) {
          return platformRoles.has(`${bound[0]}:platform_admin`) ? ({ ok: 1 } as T) : null
        }
        return null
      },
      async all<T>(): Promise<{ results: T[] }> {
        // rbac getUserRoles: SELECT role FROM user_roles WHERE user_id = ?1
        if (s.startsWith('SELECT role FROM user_roles')) {
          const roles = [...userRoles]
            .filter((k) => k.startsWith(`${bound[0]}:`))
            .map((k) => ({ role: k.split(':')[1] }))
          return { results: roles as unknown as T[] }
        }
        return { results: [] }
      },
    }
    return api
  }
  return { prepare } as unknown as D1Database
}

function makeEnv(db: D1Database, extra: Partial<Env> = {}): Env {
  return { DB: db, ...extra } as unknown as Env
}

function adminApp() {
  const app = new Hono<{ Bindings: Env; Variables: any }>()
  app.use('*', async (c, next) => {
    c.set('trace_id', 't')
    c.set('user', c.req.header('x-test-user')
      ? JSON.parse(c.req.header('x-test-user')!)
      : { sub: 'u1', email: 'u1@acme.test', iat: 1, exp: 2 })
    await next()
  })
  app.get('/api/admin/users', authify, (c) => c.json({ ok: true }))
  return app
}

// Wrap adminMiddleware so the test route only succeeds when it passes.
const authify = adminMiddleware

function rbacApp() {
  const app = new Hono<{ Bindings: Env; Variables: any }>()
  app.use('*', async (c, next) => {
    c.set('trace_id', 't')
    c.set('user', { sub: 'u1', email: 'u1@acme.test', iat: 1, exp: 2 })
    await next()
  })
  app.use('/api/*', rbacMiddleware)
  app.get('/api/admin/users', (c) => c.json({ ok: true }))
  return app
}

describe('platform-admin authority (#586)', () => {
  it('adminMiddleware DENIES a user who only has a team owner role in user_roles', async () => {
    const db = makeDb({ userRoles: new Set(['u1:owner']) })
    const res = await adminApp().fetch(new Request('http://x/api/admin/users'), makeEnv(db))
    expect(res.status).toBe(403)
  })

  it('adminMiddleware ALLOWS a bootstrapped platform admin (platform_roles row)', async () => {
    const db = makeDb({ userRoles: new Set(['u1:owner']), platformRoles: new Set(['u1:platform_admin']) })
    const res = await adminApp().fetch(new Request('http://x/api/admin/users'), makeEnv(db))
    expect(res.status).toBe(200)
  })

  it('adminMiddleware ALLOWS the env-allowlisted superuser without any DB row', async () => {
    const db = makeDb({})
    const env = makeEnv(db, { SUPERUSER_EMAIL: 'root@acme.test' } as Partial<Env>)
    const user = JSON.stringify({ sub: 'root', email: 'root@acme.test', iat: 1, exp: 2 })
    const res = await adminApp().fetch(
      new Request('http://x/api/admin/users', { headers: { 'x-test-user': user } }),
      env,
    )
    expect(res.status).toBe(200)
  })

  it('rbac matrix DENIES /api/admin/* to a plain team owner (no platform role)', async () => {
    const db = makeDb({ userRoles: new Set(['u1:owner']) })
    const res = await rbacApp().fetch(new Request('http://x/api/admin/users'), makeEnv(db))
    expect(res.status).toBe(403)
  })

  it('rbac matrix ALLOWS /api/admin/* to a platform admin', async () => {
    const db = makeDb({ userRoles: new Set(['u1:owner']), platformRoles: new Set(['u1:platform_admin']) })
    const res = await rbacApp().fetch(new Request('http://x/api/admin/users'), makeEnv(db))
    expect(res.status).toBe(200)
  })
})
