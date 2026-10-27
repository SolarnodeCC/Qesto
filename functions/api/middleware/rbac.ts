// Platform-admin guard (DD-07, issue #880; DD-16, issue #889).
//
// This file used to hold a ~45-entry route→role "permission matrix". It ran a
// D1 `user_roles` query on every authenticated request, evaluated the matrix,
// and then DISCARDED the result for everything except the platform-admin
// routes — so 40+ entries asserted protection that did not exist, and an
// engineer adding a route plus a matrix line reasonably believed it was gated.
//
// The middleware is now honest about the one thing it enforces: the platform
// admin surface under `/api/admin/*`. Everything else is authorized INSIDE the
// route, and that in-route check is the only real gate:
//   * team/tenant routes   → requireTeamPermission (lib/authz.ts)
//   * session routes       → requireSessionAccess / owner checks
//   * admin sub-apps       → adminMiddleware (defence in depth with this guard)
// See SPEC_BACKEND.md §Middleware stack. Route-level coverage — every non-public
// route rejects an unauthenticated request — is pinned by
// tests/unit/route-authorization-coverage.test.ts.
//
// Side effect (DD-16): no D1 query on non-admin requests; platform authority is
// resolved only for `/api/admin/*`.

import type { MiddlewareHandler } from 'hono'
import type { Env } from '../types'
import type { AuthVariables } from './auth'
import { isPlatformAdmin } from '../lib/platform-admin'
import { hasRecentMfa } from '../lib/mfa'

const ADMIN_PREFIX = '/api/admin/'

/**
 * `/api/admin/*` paths that are deliberately NOT platform-admin gated here.
 * Each carries its own authentication; adding to this list needs a reason.
 */
export const ADMIN_GUARD_EXEMPT = new Set<string>([
  // Called by the impersonated (non-admin) principal to end impersonation.
  'POST /api/admin/impersonation/stop',
  // Service-to-service: authenticated by the KB admin key, not a user session.
  'POST /api/admin/kb-sync',
  'POST /api/admin/kb-sync-delete',
  // Ops probe: authenticated by its own service key.
  'GET /api/admin/health',
])

export type RbacVariables = {
  /** Set by platformAdminGuard on `/api/admin/*` once platform authority is verified. */
  platformAdminVerified?: boolean
}

function deny(c: Parameters<MiddlewareHandler>[0], status: 401 | 403, code: string, message: string) {
  return c.json({ ok: false, error: { code, message }, trace_id: c.get('trace_id' as never) ?? 'unknown' }, status)
}

export const platformAdminGuard: MiddlewareHandler<{
  Bindings: Env
  Variables: AuthVariables & RbacVariables
}> = async (c, next) => {
  const path = new URL(c.req.url).pathname
  if (!path.startsWith(ADMIN_PREFIX) || c.req.method === 'OPTIONS') {
    await next()
    return
  }
  if (ADMIN_GUARD_EXEMPT.has(`${c.req.method} ${path}`)) {
    await next()
    return
  }
  const user = c.get('user')
  if (!user) return deny(c, 401, 'unauthenticated', 'Authentication required')
  // Authority comes from platform_roles (or the bootstrap env allowlist) —
  // never from a team-scoped owner/admin role (#586).
  if (!(await isPlatformAdmin(c.env, user.sub, user.email))) {
    return deny(c, 403, 'forbidden', 'Platform admin access required')
  }
  // DD-04 step-up: once every admin has enrolled, ADMIN_MFA_REQUIRED="true"
  // makes the console demand a second factor verified in the last 15 minutes.
  if (c.env.ADMIN_MFA_REQUIRED === 'true' && !hasRecentMfa(user)) {
    return deny(c, 403, 'mfa_step_up_required', 'Confirm with your authenticator code to continue')
  }
  c.set('platformAdminVerified', true)
  await next()
}
