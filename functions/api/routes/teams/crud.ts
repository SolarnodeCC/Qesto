// CODE-SPLIT — team CRUD + branding/SAML settings + custom-domain resolution
// (no behavior change).
//
// Routes:
//   GET    /resolve-domain   resolve custom domain → team (public, no auth)
//   POST   /                 create team (caller → owner)
//   GET    /                 list teams caller is a member of
//   GET    /:id              fetch team (members only)
//   PATCH  /:id              update name / samlConfig / branding (permissioned)
//   DELETE /:id              delete team (owner; personal team protected)
import { ulid } from '../../lib/ulid'
import { writeEvent } from '../../lib/observability'
import { recordAuditEvent } from '../../lib/audit'
import { denyFeature, featureAllowed } from '../../lib/entitlements'
import { readKvText, writeKvText, deleteKv } from '../../lib/kv'
import { validateBody } from '../../lib/request-validation'
import { teamDocumentKey } from '../../lib/kv-keys'
import { CreateTeamSchema, PatchTeamSchema } from './schemas'
import {
  loadTeam,
  saveTeam,
  loadUserTeamIds,
  addUserTeam,
  removeUserTeam,
  upsertUserRole,
  isOwner,
  isMemberOrOwner,
  teamDomainKey,
} from './store'
import { requireTeamPermission } from './permissions'
import type { Team, TeamsApp } from './types'

// Public custom-domain resolution — registered before auth middleware.
export function mountTeamPublicRoutes(pub: TeamsApp) {
  pub.get('/resolve-domain', async (c) => {
    const host = (c.req.query('host') ?? '').trim().toLowerCase()
    if (!host) {
      return c.json({ ok: false, error: { code: 'bad_request', message: 'host query required' }, trace_id: c.get('trace_id') }, 400)
    }
    const teamId = await readKvText(c.env.TEAMS_KV, teamDomainKey(host))
    if (!teamId) {
      return c.json({ ok: false, error: { code: 'not_found', message: 'Domain not mapped' }, trace_id: c.get('trace_id') }, 404)
    }
    const team = await loadTeam(c.env.TEAMS_KV, teamId)
    return c.json({
      ok: true,
      data: { teamId, branding: team?.branding ?? null, cnameTarget: 'join.qesto.cc' },
      trace_id: c.get('trace_id'),
    })
  })
}

export function mountTeamCrudRoutes(app: TeamsApp) {
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
}
