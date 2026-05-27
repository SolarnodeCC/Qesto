import { Hono } from 'hono'
import { authMiddleware, type AuthVariables } from '../../middleware/auth'
import { adminMiddleware, type AdminVariables } from '../../middleware/admin'
import { ulid } from '../../lib/ulid'
import { validateBody } from '../../lib/validate'
import { recordAuditEvent } from '../../lib/audit'
import { AdminCreateUserSchema, AdminPatchUserSchema } from '../../lib/validation'
import type { Env } from '../../types'

export type AdminUser = {
  id: string
  email: string
  display_name: string | null
  plan: 'free' | 'starter' | 'team'
  created_at: number
  last_login_at: number | null
  suspended_at: number | null
  admin_role: 'owner' | 'admin' | null
}

export function mountUserRoutes(app: Hono<{ Bindings: Env; Variables: AuthVariables & AdminVariables }>) {
  app.get('/users', authMiddleware, adminMiddleware, async (c) => {
    const trace_id = c.get('trace_id')
    const search = c.req.query('search') ?? ''
    const limit = Math.min(parseInt(c.req.query('limit') ?? '50'), 100)
    const offset = parseInt(c.req.query('offset') ?? '0')

    try {
      const searchLike = search ? `%${search}%` : null
      const sqlNoSearch = `
        SELECT u.id, u.email, u.display_name, u.plan, u.created_at, u.last_login_at, u.suspended_at,
               ur.role as admin_role
        FROM users u
        LEFT JOIN user_roles ur ON ur.user_id = u.id AND ur.role IN ('owner', 'admin')
        ORDER BY u.created_at DESC
        LIMIT ?1 OFFSET ?2
      `
      const sqlSearch = `
        SELECT u.id, u.email, u.display_name, u.plan, u.created_at, u.last_login_at, u.suspended_at,
               ur.role as admin_role
        FROM users u
        LEFT JOIN user_roles ur ON ur.user_id = u.id AND ur.role IN ('owner', 'admin')
        WHERE (u.email LIKE ?3 OR u.display_name LIKE ?3)
        ORDER BY u.created_at DESC
        LIMIT ?1 OFFSET ?2
      `
      const countSqlNoSearch = `SELECT COUNT(*) as n FROM users u`
      const countSqlSearch = `SELECT COUNT(*) as n FROM users u WHERE (u.email LIKE ?1 OR u.display_name LIKE ?1)`

      let stmt: D1PreparedStatement
      let countStmt: D1PreparedStatement
      if (searchLike) {
        stmt = c.env.DB.prepare(sqlSearch).bind(limit, offset, searchLike)
        countStmt = c.env.DB.prepare(countSqlSearch).bind(searchLike)
      } else {
        stmt = c.env.DB.prepare(sqlNoSearch).bind(limit, offset)
        countStmt = c.env.DB.prepare(countSqlNoSearch)
      }

      const [{ results }, countRow] = await Promise.all([
        stmt.all<AdminUser>(),
        countStmt.first<{ n: number }>(),
      ])

      return c.json({ ok: true, data: { users: results, total: countRow?.n ?? 0 }, trace_id }, 200)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch users'
      return c.json({ ok: false, error: { code: 'internal', message }, trace_id }, 500)
    }
  })

  app.post('/users', authMiddleware, adminMiddleware, async (c) => {
    const trace_id = c.get('trace_id')
    const validated = await validateBody(c, AdminCreateUserSchema)
    if ('error' in validated) return validated.error
    const { email: rawEmail, display_name, plan = 'free', admin_role } = validated.data

    const id = ulid()
    const now = Date.now()

    try {
      await c.env.DB.prepare(
        'INSERT INTO users (id, email, display_name, created_at, plan) VALUES (?1, ?2, ?3, ?4, ?5)',
      ).bind(id, rawEmail.toLowerCase().trim(), display_name ?? null, now, plan).run()

      let assignedAdminRole: AdminUser['admin_role'] = null
      if (admin_role === 'admin' || admin_role === 'owner') {
        await c.env.DB.prepare(
          'INSERT INTO user_roles (id, user_id, role, created_at) VALUES (?1, ?2, ?3, ?4)',
        ).bind(ulid(), id, admin_role, now).run()
        assignedAdminRole = admin_role
      }

      const user: AdminUser = {
        id,
        email: rawEmail.toLowerCase().trim(),
        display_name: display_name ?? null,
        plan: plan as AdminUser['plan'],
        created_at: now,
        last_login_at: null,
        suspended_at: null,
        admin_role: assignedAdminRole,
      }

      await recordAuditEvent(c, {
        action: 'user.create',
        subject_type: 'user',
        subject_id: id,
        after_snapshot: user,
        trace_id,
      })

      return c.json({ ok: true, data: user, trace_id }, 201)
    } catch (err) {
      const msg = (err as Error).message ?? ''
      if (msg.includes('UNIQUE constraint')) {
        return c.json({ ok: false, error: { code: 'conflict', message: 'Email already exists' }, trace_id }, 409)
      }
      throw err
    }
  })

  app.patch('/users/:id', authMiddleware, adminMiddleware, async (c) => {
    const trace_id = c.get('trace_id')
    const userId = c.req.param('id')
    const validated = await validateBody(c, AdminPatchUserSchema)
    if ('error' in validated) return validated.error
    const body = validated.data

    const existing = await c.env.DB.prepare(
      'SELECT id, email, display_name, plan, created_at, last_login_at, suspended_at FROM users WHERE id = ?1',
    ).bind(userId).first<Omit<AdminUser, 'admin_role'>>()

    if (!existing) {
      return c.json({ ok: false, error: { code: 'not_found', message: 'User not found' }, trace_id }, 404)
    }

    if (body.display_name !== undefined) {
      // validated by schema
    }
    if (body.plan !== undefined && ['free', 'starter', 'team'].includes(body.plan)) {
      // validated by schema + allowlist
    }

    if (body.display_name !== undefined || body.plan !== undefined) {
      const hasName = body.display_name !== undefined
      const hasPlan = body.plan !== undefined && ['free', 'starter', 'team'].includes(body.plan)
      if (hasName && hasPlan) {
        await c.env.DB.prepare('UPDATE users SET display_name = ?1, plan = ?2 WHERE id = ?3')
          .bind(body.display_name ?? null, body.plan, userId)
          .run()
      } else if (hasName) {
        await c.env.DB.prepare('UPDATE users SET display_name = ?1 WHERE id = ?2')
          .bind(body.display_name ?? null, userId)
          .run()
      } else if (hasPlan) {
        await c.env.DB.prepare('UPDATE users SET plan = ?1 WHERE id = ?2')
          .bind(body.plan, userId)
          .run()
      }
    }

    if ('admin_role' in body) {
      if (body.admin_role === null) {
        await c.env.DB.prepare(
          "DELETE FROM user_roles WHERE user_id = ?1 AND role IN ('owner', 'admin')",
        ).bind(userId).run()
      } else if (body.admin_role === 'admin' || body.admin_role === 'owner') {
        await c.env.DB.prepare(
          "INSERT INTO user_roles (id, user_id, role, created_at) VALUES (?1, ?2, ?3, ?4) ON CONFLICT(user_id, role) DO NOTHING",
        ).bind(ulid(), userId, body.admin_role, Date.now()).run()
      }

      await recordAuditEvent(c, {
        action: 'user.role_change',
        subject_type: 'user',
        subject_id: userId,
        before_snapshot: { admin_role: null },
        after_snapshot: { admin_role: body.admin_role },
        trace_id,
      })
    } else if (body.display_name !== undefined || body.plan !== undefined) {
      await recordAuditEvent(c, {
        action: 'user.update',
        subject_type: 'user',
        subject_id: userId,
        before_snapshot: existing,
        after_snapshot: { ...existing, ...body },
        trace_id,
      })
    }

    const updated = await c.env.DB.prepare(
      `SELECT u.id, u.email, u.display_name, u.plan, u.created_at, u.last_login_at, u.suspended_at,
              ur.role as admin_role
       FROM users u
       LEFT JOIN user_roles ur ON ur.user_id = u.id AND ur.role IN ('owner', 'admin')
       WHERE u.id = ?1`,
    ).bind(userId).first<AdminUser>()

    return c.json({ ok: true, data: updated, trace_id }, 200)
  })

  app.post('/users/:id/suspend', authMiddleware, adminMiddleware, async (c) => {
    const trace_id = c.get('trace_id')
    const userId = c.req.param('id')
    const now = Date.now()

    const existing = await c.env.DB.prepare('SELECT id FROM users WHERE id = ?1').bind(userId).first()
    if (!existing) {
      return c.json({ ok: false, error: { code: 'not_found', message: 'User not found' }, trace_id }, 404)
    }

    await c.env.DB.prepare('UPDATE users SET suspended_at = ?1 WHERE id = ?2').bind(now, userId).run()
    await recordAuditEvent(c, {
      action: 'user.suspend',
      subject_type: 'user',
      subject_id: userId,
      after_snapshot: { suspended_at: now },
      trace_id,
    })

    return c.json({ ok: true, data: { suspended_at: now }, trace_id }, 200)
  })

  app.post('/users/:id/restore', authMiddleware, adminMiddleware, async (c) => {
    const trace_id = c.get('trace_id')
    const userId = c.req.param('id')

    const existing = await c.env.DB.prepare('SELECT id FROM users WHERE id = ?1').bind(userId).first()
    if (!existing) {
      return c.json({ ok: false, error: { code: 'not_found', message: 'User not found' }, trace_id }, 404)
    }

    await c.env.DB.prepare('UPDATE users SET suspended_at = NULL WHERE id = ?1').bind(userId).run()
    await recordAuditEvent(c, {
      action: 'user.restore',
      subject_type: 'user',
      subject_id: userId,
      after_snapshot: { suspended_at: null },
      trace_id,
    })

    return c.json({ ok: true, data: { suspended_at: null }, trace_id }, 200)
  })
}
