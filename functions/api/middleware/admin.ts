// Platform-admin middleware — Phase 8 Step 2 / hardened for #586
//
// Checks that the authenticated user holds PLATFORM-admin authority. Platform
// authority is distinct from tenant (team) roles: it lives in the dedicated
// `platform_roles` table (role = 'platform_admin'), NOT the team-scoped
// `user_roles` table. This is the fix for #586 — previously any team owner (every
// signup, via ensurePersonalTeam) wrote an 'owner' row to user_roles and was
// therefore treated as a platform admin here.
//
// Authority is granted ONLY by:
//   1. the SUPERUSER_EMAIL / SEED_ADMIN_EMAIL env allowlist (bootstrap), or
//   2. an explicit platform_roles row (granted by an existing platform admin).
//
// Results are cached on the Hono context so downstream handlers can read
// `c.get('isAdmin')` without a second DB round-trip. Returns 403 otherwise.

import type { MiddlewareHandler } from 'hono'
import type { Env } from '../types'
import type { AuthVariables } from './auth'

// The platform-admin role label persisted in platform_roles.
const PLATFORM_ADMIN_ROLE = 'platform_admin'
type AdminRole = 'platform_admin'


export type AdminVariables = {
  isAdmin: true
  adminRole: AdminRole
}

type PlatformRoleRow = { role: string }

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

  // Seed bypass — dev / integration only. Bootstraps platform-admin authority
  // from the env allowlist (#586).
  if (c.env.SEED_ADMIN_EMAIL && user.email === c.env.SEED_ADMIN_EMAIL) {
    c.set('isAdmin', true)
    c.set('adminRole', PLATFORM_ADMIN_ROLE)
    await next()
    return
  }

  // Superuser bypass — production owner account. Bootstraps platform-admin
  // authority from the env allowlist (#586).
  if (c.env.SUPERUSER_EMAIL && user.email === c.env.SUPERUSER_EMAIL) {
    c.set('isAdmin', true)
    c.set('adminRole', PLATFORM_ADMIN_ROLE)
    await next()
    return
  }

  // Query the PLATFORM_ROLES table (#586) — NOT user_roles. Team ownership never
  // appears here, so a team owner is not a platform admin.
  // D1 transient failure → safe deny (403), not 500.
  let row: PlatformRoleRow | null = null
  try {
    row = await c.env.DB.prepare(
      `SELECT role FROM platform_roles WHERE user_id = ?1 AND role = ?2 LIMIT 1`,
    )
      .bind(user.sub, PLATFORM_ADMIN_ROLE)
      .first<PlatformRoleRow>()
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

  if (!row || row.role !== PLATFORM_ADMIN_ROLE) {
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
  c.set('adminRole', PLATFORM_ADMIN_ROLE)
  await next()
}
