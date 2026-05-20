// Admin role middleware — Phase 8 Step 2
//
// Checks that the authenticated user holds the 'owner' or 'admin' role via the
// user_roles table in D1.  Results are cached on the Hono context so downstream
// route handlers can read `c.get('isAdmin')` without a second DB round-trip.
//
// Seed admin is granted admin by default (dev/test only) via SEED_ADMIN_EMAIL env var.
// In production the user_roles table is the source of truth.
//
// Returns 403 if the user is not an admin.

import type { MiddlewareHandler } from 'hono'
import type { Env } from '../types'
import type { AuthVariables } from './auth'

const ADMIN_ROLES = ['owner', 'admin'] as const
type AdminRole = (typeof ADMIN_ROLES)[number]


export type AdminVariables = {
  isAdmin: true
  adminRole: AdminRole
}

type UserRoleRow = { role: string }

export const adminMiddleware: MiddlewareHandler<{
  Bindings: Env
  Variables: AuthVariables & AdminVariables
}> = async (c, next) => {
  const user = c.get('user')
  if (!user) {
    return c.json(
      {
        ok: false,
        error: { code: 'unauthenticated', message: 'Authentication required' },
        trace_id: c.get('trace_id'),
      },
      401,
    )
  }

  // Seed bypass — dev / integration only.
  if (c.env.SEED_ADMIN_EMAIL && user.email === c.env.SEED_ADMIN_EMAIL) {
    c.set('isAdmin', true)
    c.set('adminRole', 'admin')
    await next()
    return
  }

  // Superuser bypass — production owner account.
  if (c.env.SUPERUSER_EMAIL && user.email === c.env.SUPERUSER_EMAIL) {
    c.set('isAdmin', true)
    c.set('adminRole', 'owner')
    await next()
    return
  }

  // Query user_roles table.  The index idx_user_roles_user_id covers this lookup.
  // D1 transient failure → safe deny (403), not 500.
  let row: UserRoleRow | null = null
  try {
    row = await c.env.DB.prepare(
      `SELECT role FROM user_roles WHERE user_id = ?1 AND role IN ('owner', 'admin') LIMIT 1`,
    )
      .bind(user.sub)
      .first<UserRoleRow>()
  } catch {
    return c.json(
      {
        ok: false,
        error: { code: 'forbidden', message: 'Admin access required' },
        trace_id: c.get('trace_id'),
      },
      403,
    )
  }

  if (!row || !(ADMIN_ROLES as readonly string[]).includes(row.role)) {
    return c.json(
      {
        ok: false,
        error: { code: 'forbidden', message: 'Admin access required' },
        trace_id: c.get('trace_id'),
      },
      403,
    )
  }

  c.set('isAdmin', true)
  c.set('adminRole', row.role as AdminRole)
  await next()
}
