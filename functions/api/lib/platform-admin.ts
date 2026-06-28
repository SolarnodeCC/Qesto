// Platform-admin authority resolver — single source of truth (#586).
//
// Platform authority is distinct from tenant (team) roles: it lives in the
// dedicated `platform_roles` table (role = 'platform_admin'), NOT the team-scoped
// `user_roles` table. Authority is granted ONLY by:
//   1. the SUPERUSER_EMAIL / SEED_ADMIN_EMAIL env allowlist (bootstrap), or
//   2. an explicit platform_roles row (granted by an existing platform admin).
//
// This helper is the one place that logic lives. `adminMiddleware`, the RBAC
// role resolver, and `/api/auth/me` all call it so the page gate and the API
// gate can never drift apart.

import type { Env } from '../types'

/** The platform-admin role label persisted in platform_roles. */
export const PLATFORM_ADMIN_ROLE = 'platform_admin'

/**
 * Resolve whether a user holds PLATFORM-admin authority. Env allowlist first
 * (bootstrap), then an explicit platform_roles row. D1 transient failure →
 * fail-safe deny (false), never a throw.
 */
export async function isPlatformAdmin(
  env: Env,
  userId: string,
  email: string | undefined,
): Promise<boolean> {
  if (env.SUPERUSER_EMAIL && email === env.SUPERUSER_EMAIL) return true
  if (env.SEED_ADMIN_EMAIL && email === env.SEED_ADMIN_EMAIL) return true
  try {
    const row = await env.DB.prepare(
      `SELECT 1 AS ok FROM platform_roles WHERE user_id = ?1 AND role = ?2 LIMIT 1`,
    )
      .bind(userId, PLATFORM_ADMIN_ROLE)
      .first<{ ok: number }>()
    return !!row
  } catch {
    return false
  }
}
