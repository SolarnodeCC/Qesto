// RBAC middleware — Role-Based Access Control enforcement (Phase 8 Step 3)
//
// Permission matrix defines which roles can access which routes and methods.
// All routes go through this gate AFTER auth + plan checks.
// Missing role = viewer (read-only).
//
// Roles: owner, admin, member, viewer, guest
// Permissions cascade: owner > admin > member > viewer > guest

import type { MiddlewareHandler } from 'hono'
import type { Env } from '../types'
import type { AuthVariables } from './auth'

export type RbacVariables = {
  userRoles: readonly string[]
  canAccess: boolean
}

// ─── Permission Matrix ────────────────────────────────────────────────────────

// Define which roles can perform which actions
const PERMISSION_MATRIX: Record<string, Set<string>> = {
  // Session management
  'POST /api/sessions': new Set(['owner', 'admin', 'member']),
  'GET /api/sessions': new Set(['owner', 'admin', 'member', 'viewer', 'guest']),
  'GET /api/sessions/:id': new Set(['owner', 'admin', 'member', 'viewer', 'guest']),
  'PATCH /api/sessions/:id': new Set(['owner', 'admin', 'member']),
  'DELETE /api/sessions/:id': new Set(['owner', 'admin']),
  // Session lifecycle transitions (owner_id enforced at DB layer; matrix
  // documents intent and gates future team-member access).
  'POST /api/sessions/:id/start': new Set(['owner', 'admin']),
  'POST /api/sessions/:id/close': new Set(['owner', 'admin']),

  // Questions (CRUD)
  'POST /api/sessions/:id/questions': new Set(['owner', 'admin', 'member']),
  'GET /api/sessions/:id/questions': new Set(['owner', 'admin', 'member', 'viewer', 'guest']),
  'PATCH /api/questions/:id': new Set(['owner', 'admin', 'member']),
  'DELETE /api/questions/:id': new Set(['owner', 'admin', 'member']),

  // Votes (read-only, written via WebSocket)
  'GET /api/sessions/:id/votes': new Set(['owner', 'admin', 'member', 'viewer', 'guest']),

  // Insights (analytics, plan-gated)
  'GET /api/sessions/:id/insights': new Set(['owner', 'admin', 'member']),

  // Team/User management
  // NOTE: The RBAC matrix gates routes by the caller's *global* user_roles
  // role; team-scoped ownership (is-this-user-the-owner-of-THIS-team?) is
  // enforced inside routes/teams.ts against the TEAMS_KV membership data.
  'POST /api/teams': new Set(['owner', 'admin', 'member', 'viewer']), // any authed user can create a team
  'GET /api/teams': new Set(['owner', 'admin', 'member', 'viewer']),
  'GET /api/teams/:id': new Set(['owner', 'admin', 'member', 'viewer']),
  'PATCH /api/teams/:id': new Set(['owner', 'admin', 'member']),
  'DELETE /api/teams/:id': new Set(['owner', 'admin']),

  // User role management
  'POST /api/teams/:id/members': new Set(['owner', 'admin', 'member']),
  'GET /api/teams/:id/members': new Set(['owner', 'admin', 'member']),
  'PATCH /api/teams/:id/members/:userId': new Set(['owner', 'admin']),
  'DELETE /api/teams/:id/members/:userId': new Set(['owner', 'admin']),

  // Billing
  'GET /api/billing/plans': new Set(['owner', 'admin', 'member', 'viewer', 'guest']),
  'POST /api/billing/checkout': new Set(['owner', 'admin']),
  'GET /api/billing/invoices': new Set(['owner', 'admin']),

  // Admin endpoints
  'GET /api/admin/metrics/live': new Set(['owner', 'admin']),
  'GET /api/admin/metrics/historical': new Set(['owner', 'admin']),
  'POST /api/admin/metrics/export': new Set(['owner', 'admin']),
  'GET /api/admin/audit': new Set(['owner', 'admin']),
  'GET /api/admin/kpis': new Set(['owner', 'admin']),
  'GET /api/admin/users': new Set(['owner', 'admin']),
  'POST /api/admin/users': new Set(['owner', 'admin']),
  'PATCH /api/admin/users/:id': new Set(['owner', 'admin']),
  'POST /api/admin/users/:id/suspend': new Set(['owner', 'admin']),
  'POST /api/admin/users/:id/restore': new Set(['owner', 'admin']),
  'GET /api/admin/ops/summary': new Set(['owner', 'admin']),
  'GET /api/admin/analytics': new Set(['owner', 'admin']),
  'GET /api/admin/sprint19-baseline': new Set(['owner', 'admin']),
}

// ─── Utility Functions ────────────────────────────────────────────────────────

/**
 * Normalize a concrete request path to its matrix pattern.
 * Request paths contain literal IDs (ULIDs, UUIDs, ints, user emails); the
 * matrix keys use `:id` / `:userId` placeholders. Convert by treating any
 * segment that looks like an identifier as a placeholder.
 *
 * Matches:
 *   GET /api/teams/01HXYZ... → GET /api/teams/:id
 *   DELETE /api/teams/01HXYZ.../members/01HAAA... → DELETE /api/teams/:id/members/:userId
 */
function getRouteKey(method: string, path: string): string | null {
  const pattern = `${method} ${path}`
  if (PERMISSION_MATRIX[pattern]) return pattern

  // Split path and substitute identifier-shaped segments.
  const segments = path.split('/')
  const isIdLike = (seg: string): boolean => {
    if (!seg) return false
    // ULID (26 char Crockford), UUID, hex, numeric, or any long opaque token.
    if (/^[0-9A-HJKMNP-TV-Z]{26}$/i.test(seg)) return true
    if (/^[0-9a-f-]{8,}$/i.test(seg) && seg.length >= 8) return true
    if (/^\d+$/.test(seg)) return true
    return false
  }

  // Try both `:id` and `:userId` substitution variants. Last numeric/ULID
  // segment becomes :userId when the previous meaningful segment is 'members'.
  const variants: string[] = []
  // Variant A: replace all id-shaped segments with :id
  variants.push(segments.map((s) => (isIdLike(s) ? ':id' : s)).join('/'))
  // Variant B: if path ends in /members/<id>, use :userId for the trailing id.
  const b = [...segments]
  for (let i = 0; i < b.length; i++) {
    if (b[i] === 'members' && isIdLike(b[i + 1] ?? '')) b[i + 1] = ':userId'
    else if (isIdLike(b[i] ?? '')) b[i] = ':id'
  }
  variants.push(b.join('/'))

  for (const v of variants) {
    const key = `${method} ${v}`
    if (PERMISSION_MATRIX[key]) return key
  }
  return null
}

/**
 * Fetch user's roles from user_roles table.  Cache on context.
 */
async function getUserRoles(c: any, userId: string): Promise<string[]> {
  const cached = c.get('_rbac_cache')?.roles
  if (cached) return cached

  try {
    const rows = await (c.env.DB.prepare as any)(
      `SELECT role FROM user_roles WHERE user_id = ?1`,
    )
      .bind(userId)
      .all()

    const roles = (rows.results as Array<{ role: string }>)?.map((r: { role: string }) => r.role) ?? []
    // Default to viewer if no explicit roles
    if (roles.length === 0) roles.push('viewer')

    // Cache on context
    c.set('_rbac_cache', { roles })
    return roles
  } catch (err) {
    // Fail-safe demotion — log so ops can correlate RBAC/KV incidents (EH-05).
    console.warn('[rbac] user_roles lookup failed; demoting to viewer', {
      trace_id: c.get('trace_id'),
      userId,
      message: err instanceof Error ? err.message : String(err),
    })
    return ['viewer']
  }
}

/**
 * Check if user has any of the required roles.
 */
function hasRequiredRole(userRoles: string[], requiredRoles: Set<string>): boolean {
  return userRoles.some((role) => requiredRoles.has(role))
}

// ─── Middleware ───────────────────────────────────────────────────────────────

export const rbacMiddleware: MiddlewareHandler<{
  Bindings: Env
  Variables: AuthVariables & RbacVariables
}> = async (c: any, next) => {
  const user = c.get('user') as any
  const trace_id = c.get('trace_id')

  // If not authenticated, continue but set viewer role (handles public routes)
  if (!user) {
    c.set('userRoles', ['guest'])
    c.set('canAccess', true)
    await next()
    return
  }

  // Fetch user's roles (or default to viewer)
  const userRoles = await getUserRoles(c, user.sub)
  c.set('userRoles', userRoles)

  // Seed admin always has full access
  if (c.env.SEED_ADMIN_EMAIL && user.email === c.env.SEED_ADMIN_EMAIL) {
    c.set('userRoles', ['owner', 'admin', 'member', 'viewer'])
    c.set('canAccess', true)
    await next()
    return
  }

  // Check if route has explicit permission requirements
  const method = c.req.method
  const path = new URL(c.req.url).pathname
  const routeKey = getRouteKey(method, path)

  if (routeKey) {
    const requiredRoles = PERMISSION_MATRIX[routeKey]
    if (!hasRequiredRole(userRoles, requiredRoles)) {
      c.set('canAccess', false)
      return c.json(
        {
          ok: false,
          error: {
            code: 'forbidden',
            message: `Route requires role: ${Array.from(requiredRoles).join(' | ')}`,
          },
          trace_id,
        },
        403,
      )
    }
  }

  // Permission check passed (or route has no explicit requirement)
  c.set('canAccess', true)
  await next()
}
