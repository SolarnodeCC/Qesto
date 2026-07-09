/**
 * Canonical team-permission gate (dual-auth consolidation, audit finding
 * "Dual auth model"). Routes that authorise by team-scoped permission should use
 * this single helper instead of re-implementing load-team → hasTeamPermission →
 * error inline. It loads the team, verifies the caller holds `permission`, and
 * returns either the team or a ready-to-return error Response built with the
 * standard `errorResponse` (ADR-0070): 404 when the team is missing, 403 when
 * the permission is denied.
 *
 * Usage:
 *   const authz = await authorizeTeamPermission(c, teamId, 'billing:manage')
 *   if (!authz.ok) return authz.res
 *   const { team } = authz
 */
import { type Context } from 'hono'
import type { Env } from '../types'
import type { AuthVariables } from '../middleware/auth'
import type { Team } from '../routes/teams'
import { readKvJson } from './kv'
import { teamDocumentKey } from './kv-keys'
import { hasTeamPermission, type Permission } from './authz'
import { errorResponse } from './error-handler'

/**
 * Plain membership check (owner counts as member). Single definition for the
 * predicate that was previously re-declared per route file; for permission-level
 * checks use {@link authorizeTeamPermission} instead.
 */
export function isTeamMember(team: Team, userId: string): boolean {
  return team.ownerId === userId || team.members.some((m) => m.userId === userId)
}

export async function authorizeTeamPermission<
  E extends { Bindings: Env; Variables: AuthVariables },
>(
  c: Context<E>,
  teamId: string,
  permission: Permission,
  forbiddenMessage = 'Insufficient team permission',
): Promise<{ ok: true; team: Team } | { ok: false; res: Response }> {
  const team = await readKvJson<Team>(c.env.TEAMS_KV, teamDocumentKey(teamId))
  if (!team) return { ok: false, res: errorResponse(c, 404, 'not_found', 'Team not found') }
  const allowed = await hasTeamPermission(c.env.DB, team, c.get('user').sub, permission)
  if (!allowed) return { ok: false, res: errorResponse(c, 403, 'forbidden', forbiddenMessage) }
  return { ok: true, team }
}
