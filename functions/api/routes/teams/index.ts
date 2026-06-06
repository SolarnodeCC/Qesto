// CODE-SPLIT — team routes composed from subrouters (no behavior change).
//
// Teams live in TEAMS_KV as `team:{id}` → JSON blob, and membership is
// additionally represented in D1's `user_roles` table so the shared RBAC
// middleware (middleware/rbac.ts) can answer per-request permission checks.
//
// Routes (all require auth unless noted):
//   GET    /api/teams/resolve-domain        resolve custom domain → team (public)
//   POST   /api/teams                        create team (caller → owner)
//   GET    /api/teams                        list teams caller is a member of
//   GET    /api/teams/:id                    fetch team (members only)
//   PATCH  /api/teams/:id                    update name / samlConfig / branding
//   DELETE /api/teams/:id                    delete team (owner)
//   GET    /api/teams/:id/roles              list custom roles + assignments
//   POST   /api/teams/:id/roles              create custom role
//   PATCH  /api/teams/:id/roles/:roleId      update custom role
//   DELETE /api/teams/:id/roles/:roleId      delete custom role + assignments
//   POST   /api/teams/:id/roles/:roleId/assignments            assign role
//   DELETE /api/teams/:id/roles/:roleId/assignments/:userId    unassign role
//   POST   /api/teams/:id/members            invite member by email
//   DELETE /api/teams/:id/members/:userId    remove member (owner)
import { Hono } from 'hono'
import { authMiddleware } from '../../middleware/auth'
import { planMiddleware } from '../../middleware/plan'
import { patchAuthzSchemaIfNeeded } from '../../lib/authz'
import type { Env } from '../../types'
import type { Vars } from './types'
import { mountTeamPublicRoutes, mountTeamCrudRoutes } from './crud'
import { mountTeamRoleRoutes } from './roles'
import { mountTeamMemberRoutes } from './members'

export function mountTeamRoutes(parent: Hono<{ Bindings: Env; Variables: Vars }>) {
  const pub = new Hono<{ Bindings: Env; Variables: Vars }>()
  mountTeamPublicRoutes(pub)
  parent.route('/api/teams', pub)

  const app = new Hono<{ Bindings: Env; Variables: Vars }>()

  // All remaining team routes require authentication + plan context.
  app.use('*', authMiddleware)
  app.use('*', planMiddleware)
  app.use('*', async (c, next) => {
    await patchAuthzSchemaIfNeeded(c.env.DB)
    await next()
  })

  mountTeamCrudRoutes(app)
  mountTeamRoleRoutes(app)
  mountTeamMemberRoutes(app)

  parent.route('/api/teams', app)
}

// ─── Re-exports preserving the public surface of the original teams.ts ────────
export type {
  Role,
  SamlConfig,
  TeamMember,
  TeamBranding,
  Team,
} from './types'
export {
  loadTeam,
  saveTeam,
  loadUserTeamIds,
  addUserTeam,
  ensurePersonalTeam,
  attachUserToTeam,
  consumeInvite,
} from './store'
