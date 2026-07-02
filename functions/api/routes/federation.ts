/**
 * FEDERATION-01 / FEDERATION-CONSENT-01 — cross-org trust links.
 */
import { Hono } from 'hono'
import { errorResponse } from '../lib/error-handler'
import { z } from 'zod'
import { authMiddleware, type AuthVariables } from '../middleware/auth'
import { planMiddleware, type PlanVariables } from '../middleware/plan'
import { validateBody } from '../lib/request-validation'
import {
  FederationScopeSchema,
  consentFederationLink,
  createFederationLink,
  listTeamFederationLinks,
} from '../lib/federation'
import { listFederationLibrary } from '../lib/federation-library'
import { writeEvent } from '../lib/observability'
import { mintFederationInvite, verifyFederationInvite } from '../lib/connect-invite'
import { evaluateJoin } from '../lib/connect-join'
import { isInviteRevoked, revokeInvite } from '../lib/connect-revocation'
import { readKvJson, writeKvJson } from '../lib/kv'
import { teamDocumentKey } from '../lib/kv-keys'
import { recordAuditEvent } from '../lib/audit'
import type { Team } from './teams'
import type { Env } from '../types'

type Vars = AuthVariables & PlanVariables

const CreateLinkSchema = z.object({
  sourceTeamId: z.string().min(1),
  targetTeamId: z.string().min(1),
  scopes: z.array(FederationScopeSchema).min(1),
})

/** CONNECT-INVITE-01 — mint a scoped, time-limited federation invite (ADR-0062). */
const ConnectInviteSchema = z.object({
  hostTeamId: z.string().min(1),
  sessionId: z.string().min(1),
  inviteeTeamId: z.string().min(1).nullable().optional(),
  scope: z.enum(['participate', 'co_host']).optional(),
  ttlSeconds: z.number().int().positive().optional(),
})

/** CONNECT-JOIN-01 — accept an invite and join a federated session. */
const ConnectJoinSchema = z.object({
  token: z.string().min(1),
  joiningTeamId: z.string().min(1),
})

/** CONNECT-AUDIT-01 — revoke an outstanding invite by jti. */
const ConnectRevokeSchema = z.object({
  hostTeamId: z.string().min(1),
  jti: z.string().min(1),
  sessionId: z.string().min(1),
})

const FEDERATION_MEMBERS_KEY = (sessionId: string) => `connect:session:${sessionId}:members`
type StoredMember = { teamId: string; scope: 'participate' | 'co_host'; regionId: string; joinedAt: number }

function isTeamMember(team: Team, userId: string): boolean {
  return team.ownerId === userId || team.members.some((m) => m.userId === userId)
}

export function mountFederationRoutes(parent: Hono<{ Bindings: Env; Variables: Vars }>) {
  const app = new Hono<{ Bindings: Env; Variables: Vars }>()
  app.use('*', authMiddleware)
  app.use('*', planMiddleware)

  app.get('/links', async (c) => {
    const teamId = c.req.query('teamId')
    if (!teamId || !c.env.TEAMS_KV) {
      return errorResponse(c, 400, 'bad_request', 'teamId required')
    }
    const links = await listTeamFederationLinks(c.env.TEAMS_KV, teamId)
    return c.json({ ok: true, data: { links }, trace_id: c.get('trace_id') })
  })

  app.post('/links', async (c) => {
    if (c.get('plan') !== 'team') {
      return errorResponse(c, 403, 'upgrade_required', 'Federation requires Team plan')
    }
    if (!c.env.TEAMS_KV) {
      return errorResponse(c, 503, 'kv_unavailable', 'TEAMS_KV required')
    }
    const parsed = await validateBody(c, CreateLinkSchema)
    if ('error' in parsed) return parsed.error
    const link = await createFederationLink(c.env.TEAMS_KV, {
      ...parsed.data,
      createdBy: c.get('user').sub,
    })
    writeEvent(c.env.METRICS_AE, { name: 'federation.link_created', teamId: parsed.data.sourceTeamId, detail: link.id })
    return c.json({ ok: true, data: { link }, trace_id: c.get('trace_id') }, 201)
  })

  app.post('/links/:id/consent', async (c) => {
    if (!c.env.TEAMS_KV) {
      return errorResponse(c, 503, 'kv_unavailable', 'TEAMS_KV required')
    }
    const link = await consentFederationLink(c.env.TEAMS_KV, c.req.param('id'))
    if (!link) {
      return errorResponse(c, 404, 'not_found', 'Link not found or not pending')
    }
    writeEvent(c.env.METRICS_AE, { name: 'federation.consent_granted', teamId: link.targetTeamId, detail: link.id })
    return c.json({ ok: true, data: { link }, trace_id: c.get('trace_id') })
  })

  // CONNECT-INVITE-01 (ADR-0062) — host mints a scoped, signed, TTL-bound invite
  // admitting another tenant into a federated session. Sovereign hosts are refused
  // at mint (sovereign exclusion is absolute, ADR-0059). Fail-closed without a key.
  app.post('/connect/invites', async (c) => {
    const secret = c.env.CONNECT_INVITE_SECRET
    if (!secret) {
      return errorResponse(c, 503, 'federation_disabled', 'Federation invite signing key not configured')
    }
    if (!c.env.TEAMS_KV) {
      return errorResponse(c, 503, 'kv_unavailable', 'TEAMS_KV required')
    }
    const parsed = await validateBody(c, ConnectInviteSchema)
    if ('error' in parsed) return parsed.error

    const host = await readKvJson<Team>(c.env.TEAMS_KV, teamDocumentKey(parsed.data.hostTeamId))
    if (!host) {
      return errorResponse(c, 404, 'not_found', 'Host team not found')
    }
    if (!isTeamMember(host, c.get('user').sub)) {
      return errorResponse(c, 403, 'forbidden', 'Not a member of the host team')
    }

    const minted = await mintFederationInvite(
      secret,
      { teamId: host.id, isSovereign: host.isSovereign === true },
      {
        sid: parsed.data.sessionId,
        invitee: parsed.data.inviteeTeamId ?? null,
        scope: parsed.data.scope ?? 'participate',
        ...(parsed.data.ttlSeconds !== undefined ? { ttl: parsed.data.ttlSeconds } : {}),
      },
    )
    if (!minted.ok) {
      // A sovereign host attempting federation is a policy event, not a no-op.
      return errorResponse(c, 403, minted.code, minted.message)
    }

    await recordAuditEvent(c, {
      action: 'connect.invite.minted',
      subject_type: 'session',
      subject_id: parsed.data.sessionId,
      after_snapshot: {
        jti: minted.claims.jti,
        host: minted.claims.host,
        invitee: minted.claims.invitee,
        scope: minted.claims.scope,
        exp: minted.claims.exp,
      },
      trace_id: c.get('trace_id'),
    })
    writeEvent(c.env.METRICS_AE, { name: 'connect.invite_minted', teamId: host.id, plan: c.get('plan'), detail: minted.claims.jti, traceId: c.get('trace_id') })

    return c.json({ ok: true, data: { token: minted.token, invite: minted.claims }, trace_id: c.get('trace_id') }, 201)
  })

  // CONNECT-JOIN-01 (ADR-0062) — a tenant accepts an invite and joins the federated
  // session. Re-checks the INVITEE for sovereign exclusion + region match + revocation
  // (the mint guard only covered the host). Aggregates only cross-tenant (ZK preserved).
  app.post('/connect/join', async (c) => {
    const secret = c.env.CONNECT_INVITE_SECRET
    if (!secret) {
      return errorResponse(c, 503, 'federation_disabled', 'Federation invite signing key not configured')
    }
    if (!c.env.TEAMS_KV) {
      return errorResponse(c, 503, 'kv_unavailable', 'TEAMS_KV required')
    }
    const parsed = await validateBody(c, ConnectJoinSchema)
    if ('error' in parsed) return parsed.error

    const verified = await verifyFederationInvite(secret, parsed.data.token)
    if (!verified.ok) {
      return errorResponse(c, 401, 'invite_invalid', `Invite ${verified.reason}`)
    }
    const claims = verified.claims

    const joiningTeam = await readKvJson<Team>(c.env.TEAMS_KV, teamDocumentKey(parsed.data.joiningTeamId))
    if (!joiningTeam) {
      return errorResponse(c, 404, 'not_found', 'Joining team not found')
    }
    if (!isTeamMember(joiningTeam, c.get('user').sub)) {
      return errorResponse(c, 403, 'forbidden', 'Not a member of the joining team')
    }
    const hostTeam = await readKvJson<Team>(c.env.TEAMS_KV, teamDocumentKey(claims.host))
    if (!hostTeam) {
      return errorResponse(c, 404, 'not_found', 'Host team no longer exists')
    }

    const revoked = await isInviteRevoked(c.env.TEAMS_KV, claims.jti)
    const members = (await readKvJson<StoredMember[]>(c.env.TEAMS_KV, FEDERATION_MEMBERS_KEY(claims.sid))) ?? []

    const decision = evaluateJoin({
      claims,
      tenant: {
        teamId: joiningTeam.id,
        isSovereign: joiningTeam.isSovereign === true,
        regionId: joiningTeam.regionId,
      },
      hostRegionId: hostTeam.regionId,
      revoked,
      existingMembers: members,
    })

    if (!decision.ok) {
      writeEvent(c.env.METRICS_AE, { name: 'connect.join_denied', teamId: joiningTeam.id, plan: c.get('plan'), detail: decision.code, traceId: c.get('trace_id') })
      const status = decision.code === 'already_member' ? 409 : 403
      return errorResponse(c, status, decision.code, decision.message)
    }

    members.push(decision.member)
    await writeKvJson(c.env.TEAMS_KV, FEDERATION_MEMBERS_KEY(claims.sid), members)

    await recordAuditEvent(c, {
      action: 'connect.session.joined',
      subject_type: 'session',
      subject_id: claims.sid,
      after_snapshot: { jti: claims.jti, teamId: joiningTeam.id, region: decision.member.regionId, scope: decision.member.scope },
      trace_id: c.get('trace_id'),
    })
    writeEvent(c.env.METRICS_AE, { name: 'connect.session_joined', teamId: joiningTeam.id, plan: c.get('plan'), detail: claims.sid, traceId: c.get('trace_id') })

    return c.json({ ok: true, data: { sessionId: claims.sid, member: decision.member, tenantCount: members.length + 1 }, trace_id: c.get('trace_id') }, 201)
  })

  // CONNECT-AUDIT-01 (ADR-0062) — host revokes an outstanding invite by jti; the
  // join path checks this tombstone before admitting a tenant.
  app.post('/connect/invites/revoke', async (c) => {
    if (!c.env.TEAMS_KV) {
      return errorResponse(c, 503, 'kv_unavailable', 'TEAMS_KV required')
    }
    const parsed = await validateBody(c, ConnectRevokeSchema)
    if ('error' in parsed) return parsed.error

    const host = await readKvJson<Team>(c.env.TEAMS_KV, teamDocumentKey(parsed.data.hostTeamId))
    if (!host) {
      return errorResponse(c, 404, 'not_found', 'Host team not found')
    }
    if (!isTeamMember(host, c.get('user').sub)) {
      return errorResponse(c, 403, 'forbidden', 'Not a member of the host team')
    }

    await revokeInvite(c.env.TEAMS_KV, {
      jti: parsed.data.jti,
      sessionId: parsed.data.sessionId,
      revokedBy: c.get('user').sub,
      revokedAt: Date.now(),
    })

    await recordAuditEvent(c, {
      action: 'connect.invite.revoked',
      subject_type: 'session',
      subject_id: parsed.data.sessionId,
      after_snapshot: { jti: parsed.data.jti },
      trace_id: c.get('trace_id'),
    })
    writeEvent(c.env.METRICS_AE, { name: 'connect.invite_revoked', teamId: host.id, plan: c.get('plan'), detail: parsed.data.jti, traceId: c.get('trace_id') })

    return c.json({ ok: true, data: { revoked: true, jti: parsed.data.jti }, trace_id: c.get('trace_id') })
  })

  app.get('/beta', (c) =>
    c.json({
      ok: true,
      data: {
        federationV1Beta: true,
        scopes: ['read_sessions', 'share_templates'],
        consentRequired: true,
      },
      trace_id: c.get('trace_id'),
    }),
  )

  app.get('/library', async (c) => {
    const teamId = c.req.query('teamId')
    if (!teamId || !c.env.TEAMS_KV || !c.env.TEMPLATES_KV) {
      return errorResponse(c, 400, 'bad_request', 'teamId required')
    }
    const entries = await listFederationLibrary(c.env.TEAMS_KV, c.env.TEMPLATES_KV, teamId)
    return c.json({ ok: true, data: { entries }, trace_id: c.get('trace_id') })
  })

  parent.route('/api/federation', app)
}
