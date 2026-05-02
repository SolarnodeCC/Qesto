// Team management routes.
//
// Teams live in TEAMS_KV as `team:{id}` → JSON blob, and membership is
// additionally represented in D1's `user_roles` table so the shared RBAC
// middleware (middleware/rbac.ts) can answer per-request permission checks.
//
// Routes (all require auth):
//   POST   /api/teams                       create team (caller → owner)
//   GET    /api/teams                       list teams caller is a member of
//   GET    /api/teams/:id                   fetch team (members only)
//   PATCH  /api/teams/:id                   update name / samlConfig (owner)
//   POST   /api/teams/:id/members           invite member by email (owner/admin)
//   DELETE /api/teams/:id/members/:userId   remove member (owner)
//
// KV shape (TEAMS_KV):
//   team:{teamId}        → Team JSON blob (see Team type below)
//   user-teams:{userId}  → string[] of teamIds for reverse lookup (GET /teams)
//   team-invite:{token}  → { teamId, email, role, createdAt } (1-day TTL)

import { Hono } from 'hono'
import { z } from 'zod'
import { ulid } from '../lib/ulid'
import { generateMagicLinkToken, hashMagicLinkToken } from '../lib/tokens'
import { sendEmail } from '../lib/email'
import { authMiddleware, type AuthVariables } from '../middleware/auth'
import { planMiddleware, type PlanVariables } from '../middleware/plan'
import { writeEvent } from '../lib/observability'
import { denyFeature, denyLimit, featureAllowed, maxTeamMembersForPlan } from '../lib/entitlements'
import { readKvJson, writeKvJson } from '../lib/kv'
import { TEAM_INVITE_TTL_SECONDS } from '../lib/constants'
import type { Env } from '../types'

type Role = 'owner' | 'admin' | 'member' | 'viewer'

export type SamlConfig = {
  idpEntityId: string              // IdP's entity ID (issuer)
  idpSsoUrl: string                // IdP's single sign-on URL (HTTP-Redirect binding)
  idpCertificate?: string | undefined // PEM-encoded cert — parsed but not yet used for sig check (SEC-SAML-01)
}

export type TeamMember = {
  userId: string
  email: string
  role: Role
  joinedAt: number
}

export type Team = {
  id: string
  name: string
  ownerId: string
  members: TeamMember[]
  plan: 'free' | 'starter' | 'team'
  samlConfig: SamlConfig | null
  createdAt: number
}

type Vars = AuthVariables & PlanVariables

// ─── KV helpers ──────────────────────────────────────────────────────────────

const teamKey = (id: string) => `team:${id}`
const userTeamsKey = (userId: string) => `user-teams:${userId}`
const inviteKey = (tokenHash: string) => `team-invite:${tokenHash}`

async function loadTeam(kv: KVNamespace, id: string): Promise<Team | null> {
  return readKvJson<Team>(kv, teamKey(id))
}

async function saveTeam(kv: KVNamespace, team: Team): Promise<void> {
  await writeKvJson(kv, teamKey(team.id), team)
}

async function loadUserTeamIds(kv: KVNamespace, userId: string): Promise<string[]> {
  return (await readKvJson<string[]>(kv, userTeamsKey(userId))) ?? []
}

async function addUserTeam(kv: KVNamespace, userId: string, teamId: string): Promise<void> {
  const ids = await loadUserTeamIds(kv, userId)
  if (!ids.includes(teamId)) {
    ids.push(teamId)
    await writeKvJson(kv, userTeamsKey(userId), ids)
  }
}

async function removeUserTeam(kv: KVNamespace, userId: string, teamId: string): Promise<void> {
  const ids = await loadUserTeamIds(kv, userId)
  const filtered = ids.filter((id) => id !== teamId)
  if (filtered.length !== ids.length) {
    await writeKvJson(kv, userTeamsKey(userId), filtered)
  }
}

// ─── Membership helpers ──────────────────────────────────────────────────────

function findMember(team: Team, userId: string): TeamMember | undefined {
  return team.members.find((m) => m.userId === userId)
}

function isOwner(team: Team, userId: string): boolean {
  return team.ownerId === userId
}

function isMemberOrOwner(team: Team, userId: string): boolean {
  return isOwner(team, userId) || team.members.some((m) => m.userId === userId)
}

/**
 * Persist role in D1 user_roles so the shared RBAC middleware can enforce
 * team-level permissions uniformly. Team scoping is out of v1 scope — we only
 * track a global role per user. Owners/admins of any team get owner/admin role.
 */
async function upsertUserRole(db: D1Database, userId: string, role: Role): Promise<void> {
  const id = ulid()
  const now = Date.now()
  // ON CONFLICT(user_id, role) DO NOTHING — role already exists.
  await db
    .prepare(
      `INSERT INTO user_roles (id, user_id, role, created_at)
       VALUES (?1, ?2, ?3, ?4)
       ON CONFLICT(user_id, role) DO NOTHING`,
    )
    .bind(id, userId, role, now)
    .run()
}

// ─── Validation schemas ──────────────────────────────────────────────────────

const CreateTeamSchema = z.object({
  name: z.string().min(1).max(100).trim(),
})

const SamlConfigSchema = z.object({
  idpEntityId: z.string().min(1).max(512),
  idpSsoUrl: z.string().url().max(1024),
  idpCertificate: z.string().max(16_384).optional(),
})

const PatchTeamSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  samlConfig: SamlConfigSchema.nullable().optional(),
})

const InviteMemberSchema = z.object({
  email: z.string().email().max(254),
  role: z.enum(['admin', 'member', 'viewer']).default('member'),
})

// ─── Routes ──────────────────────────────────────────────────────────────────

export function mountTeamRoutes(parent: Hono<{ Bindings: Env; Variables: Vars }>) {
  const app = new Hono<{ Bindings: Env; Variables: Vars }>()

  // All team routes require authentication + plan context.
  app.use('*', authMiddleware)
  app.use('*', planMiddleware)

  // ───────────────────────────────────────────────────────────────────────────
  // POST /api/teams — create team
  // ───────────────────────────────────────────────────────────────────────────
  app.post('/', async (c) => {
    const body = (await c.req.json().catch(() => null)) as unknown
    const parsed = CreateTeamSchema.safeParse(body)
    if (!parsed.success) {
      return c.json(
        {
          ok: false,
          error: { code: 'validation', message: 'Invalid team payload', details: parsed.error.flatten() },
          trace_id: c.get('trace_id'),
        },
        400,
      )
    }

    const user = c.get('user')
    const plan = c.get('plan')
    const now = Date.now()
    const team: Team = {
      id: ulid(),
      name: parsed.data.name,
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
        { ok: false, error: { code: 'forbidden', message: 'Only the team owner can update a team' }, trace_id: c.get('trace_id') },
        403,
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

    if (parsed.data.name !== undefined) team.name = parsed.data.name
    if (parsed.data.samlConfig !== undefined) {
      const plan = c.get('plan')
      const quotas = c.get('planQuotas')
      if (parsed.data.samlConfig !== null && !featureAllowed(quotas, 'samlSso')) {
        return c.json({ ok: false, error: denyFeature(plan, 'samlSso'), trace_id: c.get('trace_id') }, 403)
      }
      team.samlConfig = parsed.data.samlConfig
    }

    await saveTeam(c.env.TEAMS_KV, team)
    return c.json({ ok: true, data: { team }, trace_id: c.get('trace_id') })
  })

  // ───────────────────────────────────────────────────────────────────────────
  // POST /api/teams/:id/members — invite member by email
  // Issues a magic-link style invite token; member is added on acceptance.
  // ───────────────────────────────────────────────────────────────────────────
  app.post('/:id/members', async (c) => {
    const user = c.get('user')
    const team = await loadTeam(c.env.TEAMS_KV, c.req.param('id'))
    if (!team) {
      return c.json(
        { ok: false, error: { code: 'not_found', message: 'Team not found' }, trace_id: c.get('trace_id') },
        404,
      )
    }
    // Owner or admin can invite.
    const self = findMember(team, user.sub)
    if (!isOwner(team, user.sub) && self?.role !== 'admin') {
      return c.json(
        { ok: false, error: { code: 'forbidden', message: 'Only owners/admins can invite members' }, trace_id: c.get('trace_id') },
        403,
      )
    }

    const body = (await c.req.json().catch(() => null)) as unknown
    const parsed = InviteMemberSchema.safeParse(body)
    if (!parsed.success) {
      return c.json(
        {
          ok: false,
          error: { code: 'validation', message: 'Invalid invite payload', details: parsed.error.flatten() },
          trace_id: c.get('trace_id'),
        },
        400,
      )
    }

    const email = parsed.data.email.toLowerCase().trim()
    // No-op if already a member.
    if (team.members.some((m) => m.email === email)) {
      return c.json(
        { ok: false, error: { code: 'already_member', message: 'Email is already a team member' }, trace_id: c.get('trace_id') },
        409,
      )
    }
    const plan = c.get('plan')
    const limit = maxTeamMembersForPlan(plan)
    if (team.members.length >= limit) {
      return c.json(
        {
          ok: false,
          error: denyLimit(plan, `Team member limit exceeded for your ${plan} plan`, limit, team.members.length),
          trace_id: c.get('trace_id'),
        },
        403,
      )
    }

    const raw = generateMagicLinkToken()
    const tokenHash = await hashMagicLinkToken(raw)
    await c.env.TEAMS_KV.put(
      inviteKey(tokenHash),
      JSON.stringify({ teamId: team.id, email, role: parsed.data.role, createdAt: Date.now() }),
      { expirationTtl: TEAM_INVITE_TTL_SECONDS },
    )

    const inviteUrl = `${c.env.PAGES_URL}/teams/accept?token=${raw}`
    try {
      await sendEmail(c.env.RESEND_API_KEY, {
        to: email,
        subject: `You've been invited to ${team.name} on Qesto`,
        text: `${user.email} invited you to join ${team.name} on Qesto.\n\nAccept the invite (valid 24 hours):\n${inviteUrl}`,
        html: `<p><strong>${user.email}</strong> invited you to join <strong>${team.name}</strong> on Qesto.</p><p>The invite is valid for 24 hours.</p><p><a href="${inviteUrl}">Accept invite</a></p>`,
      })
    } catch (err) {
      console.error(`[teams] invite email delivery failed: ${(err as Error).message}`)
    }

    return c.json(
      { ok: true, data: { invited: true, email, role: parsed.data.role }, trace_id: c.get('trace_id') },
      202,
    )
  })

  // ───────────────────────────────────────────────────────────────────────────
  // DELETE /api/teams/:id/members/:userId — remove member (owner only)
  // ───────────────────────────────────────────────────────────────────────────
  app.delete('/:id/members/:userId', async (c) => {
    const user = c.get('user')
    const targetId = c.req.param('userId')
    const team = await loadTeam(c.env.TEAMS_KV, c.req.param('id'))
    if (!team) {
      return c.json(
        { ok: false, error: { code: 'not_found', message: 'Team not found' }, trace_id: c.get('trace_id') },
        404,
      )
    }
    if (!isOwner(team, user.sub)) {
      return c.json(
        { ok: false, error: { code: 'forbidden', message: 'Only the team owner can remove members' }, trace_id: c.get('trace_id') },
        403,
      )
    }
    if (targetId === team.ownerId) {
      return c.json(
        { ok: false, error: { code: 'invalid_target', message: 'Cannot remove the team owner' }, trace_id: c.get('trace_id') },
        400,
      )
    }

    const before = team.members.length
    team.members = team.members.filter((m) => m.userId !== targetId)
    if (team.members.length === before) {
      return c.json(
        { ok: false, error: { code: 'not_found', message: 'User is not a member of this team' }, trace_id: c.get('trace_id') },
        404,
      )
    }

    await saveTeam(c.env.TEAMS_KV, team)
    await removeUserTeam(c.env.TEAMS_KV, targetId, team.id)

    return c.json({ ok: true, data: { removed: true, userId: targetId }, trace_id: c.get('trace_id') })
  })

  parent.route('/api/teams', app)
}

// ─── Internal helpers used by the SAML acceptance flow (auth.ts) ─────────────

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
  const raw = await kv.get(inviteKey(tokenHash))
  if (!raw) return null
  await kv.delete(inviteKey(tokenHash))
  try {
    return JSON.parse(raw) as { teamId: string; email: string; role: Role }
  } catch {
    return null
  }
}

export { loadTeam, saveTeam }
