// Team management routes.
//
// Teams live in TEAMS_KV as `team:{id}` → JSON blob, and membership is
// additionally represented in D1's `user_roles` table so the shared RBAC
// middleware (middleware/rbac.ts) can answer per-request permission checks.
//
// Routes (all require auth except GET /resolve-domain):
//   GET    /api/teams/resolve-domain         resolve a custom domain → team (public)
//   POST   /api/teams                        create team (caller → owner)
//   GET    /api/teams                        list teams caller is a member of
//   GET    /api/teams/:id/roles ...          custom roles + assignments (roles.ts)
//   GET    /api/teams/:id                    fetch team (members only)
//   PATCH  /api/teams/:id                    update name / samlConfig / branding (owner)
//   POST   /api/teams/:id/members            invite member by email (members.ts)
//   DELETE /api/teams/:id/members/:userId    remove member (members.ts)
//   DELETE /api/teams/:id                    delete team (owner)
//
// KV shape (TEAMS_KV):
//   team:{teamId}        → Team JSON blob (see Team type in ./shared)
//   user-teams:{userId}  → string[] of teamIds for reverse lookup (GET /teams)
//   team-invite:{token}  → { teamId, email, role, createdAt } (1-day TTL)
//
// This file owns team CRUD + the sub-app wiring; the custom-role and membership
// route groups live in ./roles and ./members, and shared types/helpers/schemas
// in ./shared (decomposed from the former single 993-LOC routes/teams.ts, #687).

import { Hono } from 'hono'
import { errorResponse } from '../../lib/error-handler'
import { ulid } from '../../lib/ulid'
import { authMiddleware } from '../../middleware/auth'
import { planMiddleware } from '../../middleware/plan'
import { writeEvent } from '../../lib/observability'
import { denyFeature, featureAllowed } from '../../lib/entitlements'
import { patchAuthzSchemaIfNeeded } from '../../lib/authz'
import { recordAuditEvent } from '../../lib/audit'
import { readKvText, writeKvText, deleteKv } from '../../lib/kv'
import { validateBody } from '../../lib/request-validation'
import { validateKvJson, TeamInviteTokenSchema } from '../../lib/protocol-schemas'
import { teamDocumentKey, teamInviteKey } from '../../lib/kv-keys'
import type { Env } from '../../types'
import {
  type Vars,
  type Team,
  type Role,
  CreateTeamSchema,
  PatchTeamSchema,
  loadTeam,
  saveTeam,
  loadUserTeamIds,
  addUserTeam,
  removeUserTeam,
  isMemberOrOwner,
  isOwner,
  upsertUserRole,
  requireTeamPermission,
  teamDomainKey,
} from './shared'
import { registerRoleRoutes } from './roles'
import { registerMemberRoutes } from './members'

// ─── Routes ──────────────────────────────────────────────────────────────────

export function mountTeamRoutes(parent: Hono<{ Bindings: Env; Variables: Vars }>) {
  const app = new Hono<{ Bindings: Env; Variables: Vars }>()

  app.get('/resolve-domain', async (c) => {
    const host = (c.req.query('host') ?? '').trim().toLowerCase()
    if (!host) {
      return errorResponse(c, 400, 'bad_request', 'host query required')
    }
    const teamId = await readKvText(c.env.TEAMS_KV, teamDomainKey(host))
    if (!teamId) {
      return errorResponse(c, 404, 'not_found', 'Domain not mapped')
    }
    const team = await loadTeam(c.env.TEAMS_KV, teamId)
    return c.json({
      ok: true,
      data: { teamId, branding: team?.branding ?? null, cnameTarget: 'join.qesto.cc' },
      trace_id: c.get('trace_id'),
    })
  })

  // All team routes below require authentication + plan context.
  app.use('*', authMiddleware)
  app.use('*', planMiddleware)
  app.use('*', async (c, next) => {
    await patchAuthzSchemaIfNeeded(c.env.DB)
    await next()
  })

  // ───────────────────────────────────────────────────────────────────────────
  // POST /api/teams — create team
  // ───────────────────────────────────────────────────────────────────────────
  app.post('/', async (c) => {
    const validated = await validateBody(c, CreateTeamSchema)
    if ('error' in validated) {
      return validated.error
    }
    const { data: body } = validated

    const user = c.get('user')
    const plan = c.get('plan')
    const now = Date.now()
    const team: Team = {
      id: ulid(),
      name: body.name,
      ownerId: user.sub,
      members: [
        { userId: user.sub, email: user.email, role: 'owner', joinedAt: now },
      ],
      plan,
      samlConfig: null,
      createdAt: now,
    }

    await saveTeam(c.env.TEAMS_KV, team)
    await addUserTeam(c.env.TEAMS_KV, user.sub, team.id)
    await upsertUserRole(c.env.DB, user.sub, 'owner')
    await recordAuditEvent(c, {
      action: 'team.create',
      subject_type: 'team',
      subject_id: team.id,
      after_snapshot: { name: team.name, ownerId: team.ownerId },
    })

    writeEvent(c.env.METRICS_AE, {
      name: 'team_created',
      userId: user.sub,
      teamId: team.id,
      plan,
      traceId: c.get('trace_id'),
    })

    return c.json({ ok: true, data: { team }, trace_id: c.get('trace_id') }, 201)
  })

  // ───────────────────────────────────────────────────────────────────────────
  // GET /api/teams — list teams caller belongs to
  // ───────────────────────────────────────────────────────────────────────────
  app.get('/', async (c) => {
    const user = c.get('user')
    const ids = await loadUserTeamIds(c.env.TEAMS_KV, user.sub)
    const teams: Team[] = []
    for (const id of ids) {
      const t = await loadTeam(c.env.TEAMS_KV, id)
      if (t && isMemberOrOwner(t, user.sub)) teams.push(t)
    }
    return c.json({ ok: true, data: { teams }, trace_id: c.get('trace_id') })
  })

  // Custom-role + assignment routes (/:id/roles...). Registered here so route
  // order matches the original single file: after list, before GET /:id.
  registerRoleRoutes(app)

  // ───────────────────────────────────────────────────────────────────────────
  // GET /api/teams/:id — fetch single team (member or owner only)
  // ───────────────────────────────────────────────────────────────────────────
  app.get('/:id', async (c) => {
    const user = c.get('user')
    const team = await loadTeam(c.env.TEAMS_KV, c.req.param('id'))
    if (!team) {
      return c.json(
        { ok: false, error: { code: 'not_found', message: 'Team not found' }, trace_id: c.get('trace_id') },
        404,
      )
    }
    if (!isMemberOrOwner(team, user.sub)) {
      return c.json(
        { ok: false, error: { code: 'forbidden', message: 'Not a member of this team' }, trace_id: c.get('trace_id') },
        403,
      )
    }
    return c.json({ ok: true, data: { team }, trace_id: c.get('trace_id') })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // PATCH /api/teams/:id — update name / samlConfig (owner only)
  // ───────────────────────────────────────────────────────────────────────────
  app.patch('/:id', async (c) => {
    const team = await loadTeam(c.env.TEAMS_KV, c.req.param('id'))
    if (!team) {
      return c.json(
        { ok: false, error: { code: 'not_found', message: 'Team not found' }, trace_id: c.get('trace_id') },
        404,
      )
    }
    const body = (await c.req.json().catch(() => null)) as unknown
    const parsed = PatchTeamSchema.safeParse(body)
    if (!parsed.success) {
      return c.json(
        {
          ok: false,
          error: { code: 'validation', message: 'Invalid patch payload', details: parsed.error.flatten() },
          trace_id: c.get('trace_id'),
        },
        400,
      )
    }

    if (parsed.data.name !== undefined) {
      const denied = await requireTeamPermission(c, team, 'team:manage_members', 'Manage members permission required')
      if (denied) return denied
      team.name = parsed.data.name
    }
    if (parsed.data.samlConfig !== undefined) {
      const denied = await requireTeamPermission(c, team, 'team:manage_auth', 'Manage authentication permission required')
      if (denied) return denied
      const plan = c.get('plan')
      const quotas = c.get('planQuotas')
      if (parsed.data.samlConfig !== null && !featureAllowed(quotas, 'samlSso')) {
        return c.json({ ok: false, error: denyFeature(plan, 'samlSso'), trace_id: c.get('trace_id') }, 403)
      }
      team.samlConfig = parsed.data.samlConfig
    }
    if (parsed.data.branding !== undefined) {
      const denied = await requireTeamPermission(c, team, 'team:manage_members', 'Manage members permission required')
      if (denied) return denied
      const quotas = c.get('planQuotas')
      if (parsed.data.branding !== null && !featureAllowed(quotas, 'customBranding')) {
        return c.json({ ok: false, error: denyFeature(c.get('plan'), 'customBranding'), trace_id: c.get('trace_id') }, 403)
      }
      const prevHost = team.branding?.customDomain ?? null
      team.branding = parsed.data.branding
      const nextHost = parsed.data.branding?.customDomain ?? null
      if (prevHost && prevHost !== nextHost) {
        await deleteKv(c.env.TEAMS_KV, teamDomainKey(prevHost))
      }
      if (nextHost) {
        await writeKvText(c.env.TEAMS_KV, teamDomainKey(nextHost), team.id)
      }
    }

    await saveTeam(c.env.TEAMS_KV, team)
    await recordAuditEvent(c, {
      action: 'team.update',
      subject_type: 'team',
      subject_id: team.id,
      after_snapshot: {
        name: team.name,
        samlConfigured: team.samlConfig !== null,
      },
    })
    return c.json({ ok: true, data: { team }, trace_id: c.get('trace_id') })
  })

  // Membership routes (POST /:id/members, DELETE /:id/members/:userId).
  // Registered after PATCH /:id, before DELETE /:id — matching the original order.
  registerMemberRoutes(app)

  // DELETE /api/teams/:id — delete team (owner only, personal team is protected)
  app.delete('/:id', async (c) => {
    const user = c.get('user')
    const team = await loadTeam(c.env.TEAMS_KV, c.req.param('id'))
    if (!team) {
      return c.json(
        { ok: false, error: { code: 'not_found', message: 'Team not found' }, trace_id: c.get('trace_id') },
        404,
      )
    }
    if (!isOwner(team, user.sub)) {
      return c.json(
        { ok: false, error: { code: 'forbidden', message: 'Only the owner can delete a team' }, trace_id: c.get('trace_id') },
        403,
      )
    }
    if (team.personal === true) {
      return c.json(
        { ok: false, error: { code: 'forbidden', message: 'Personal team cannot be deleted' }, trace_id: c.get('trace_id') },
        403,
      )
    }
    await deleteKv(c.env.TEAMS_KV, teamDocumentKey(team.id))
    for (const m of team.members) {
      await removeUserTeam(c.env.TEAMS_KV, m.userId, team.id)
    }
    await recordAuditEvent(c, {
      action: 'team.delete',
      subject_type: 'team',
      subject_id: team.id,
      before_snapshot: { name: team.name, ownerId: team.ownerId },
    })
    return c.json({ ok: true, data: { deleted: true }, trace_id: c.get('trace_id') })
  })

  parent.route('/api/teams', app)
}

// ─── Internal helpers used by the SAML acceptance / invite / signup flows ─────

/**
 * Idempotently ensure the user has a personal team in TEAMS_KV.
 * If any team in the user's list already has `personal: true`, returns it.
 * Otherwise creates a new team named "Personal" with personal: true.
 * Safe to call on every signup and on every session create — will no-op if
 * the personal team already exists.
 */
export async function ensurePersonalTeam(
  kv: KVNamespace,
  db: D1Database,
  userId: string,
  email: string,
): Promise<Team> {
  const ids = await loadUserTeamIds(kv, userId)
  for (const id of ids) {
    const t = await loadTeam(kv, id)
    if (t?.personal === true) return t
  }
  const now = Date.now()
  const team: Team = {
    id: ulid(),
    name: 'Personal',
    ownerId: userId,
    members: [{ userId, email, role: 'owner', joinedAt: now }],
    plan: 'free',
    samlConfig: null,
    createdAt: now,
    personal: true,
  }
  await saveTeam(kv, team)
  await addUserTeam(kv, userId, team.id)
  await upsertUserRole(db, userId, 'owner')
  return team
}

/**
 * Attach a user to a team (called when a SAML callback or invite acceptance
 * successfully identifies the team + user). Idempotent.
 */
export async function attachUserToTeam(
  kv: KVNamespace,
  db: D1Database,
  teamId: string,
  userId: string,
  email: string,
  role: Role = 'member',
): Promise<void> {
  const team = await loadTeam(kv, teamId)
  if (!team) return
  if (!team.members.some((m) => m.userId === userId)) {
    team.members.push({ userId, email, role, joinedAt: Date.now() })
    await saveTeam(kv, team)
    await addUserTeam(kv, userId, teamId)
  }
  await upsertUserRole(db, userId, role)
}

export async function consumeInvite(
  kv: KVNamespace,
  tokenHash: string,
): Promise<{ teamId: string; email: string; role: Role } | null> {
  const raw = await kv.get(teamInviteKey(tokenHash))
  if (!raw) return null
  await kv.delete(teamInviteKey(tokenHash))
  const invite = validateKvJson(raw, TeamInviteTokenSchema)
  if (!invite) return null
  return { teamId: invite.teamId, email: invite.email, role: invite.role as Role }
}

export { loadTeam, saveTeam, loadUserTeamIds, addUserTeam } from './shared'
export type { Team, TeamMember, SamlConfig, TeamBranding } from './shared'
