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
import { isPlatformAdmin, PLATFORM_ADMIN_ROLE } from '../lib/platform-admin'

type AdminRole = typeof PLATFORM_ADMIN_ROLE

export type AdminVariables = {
  isAdmin: true
  adminRole: AdminRole
}

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

  // Authority comes from the env allowlist (bootstrap) or an explicit
  // platform_roles row — NEVER team ownership (#586). D1 transient failure →
  // safe deny (403), not 500. See lib/platform-admin.ts.
  if (!(await isPlatformAdmin(c.env, user.sub, user.email))) {
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
