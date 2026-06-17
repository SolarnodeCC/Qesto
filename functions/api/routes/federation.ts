/**
 * FEDERATION-01 / FEDERATION-CONSENT-01 — cross-org trust links.
 */
import { Hono } from 'hono'
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
import { mintFederationInvite } from '../lib/connect-invite'
import { readKvJson } from '../lib/kv'
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
      return c.json({ ok: false, error: { code: 'bad_request', message: 'teamId required' }, trace_id: c.get('trace_id') }, 400)
    }
    const links = await listTeamFederationLinks(c.env.TEAMS_KV, teamId)
    return c.json({ ok: true, data: { links }, trace_id: c.get('trace_id') })
  })

  app.post('/links', async (c) => {
    if (c.get('plan') !== 'team') {
      return c.json({ ok: false, error: { code: 'upgrade_required', message: 'Federation requires Team plan' }, trace_id: c.get('trace_id') }, 403)
    }
    if (!c.env.TEAMS_KV) {
      return c.json({ ok: false, error: { code: 'kv_unavailable', message: 'TEAMS_KV required' }, trace_id: c.get('trace_id') }, 503)
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
      return c.json({ ok: false, error: { code: 'kv_unavailable', message: 'TEAMS_KV required' }, trace_id: c.get('trace_id') }, 503)
    }
    const link = await consentFederationLink(c.env.TEAMS_KV, c.req.param('id'))
    if (!link) {
      return c.json({ ok: false, error: { code: 'not_found', message: 'Link not found or not pending' }, trace_id: c.get('trace_id') }, 404)
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
      return c.json({ ok: false, error: { code: 'federation_disabled', message: 'Federation invite signing key not configured' }, trace_id: c.get('trace_id') }, 503)
    }
    if (!c.env.TEAMS_KV) {
      return c.json({ ok: false, error: { code: 'kv_unavailable', message: 'TEAMS_KV required' }, trace_id: c.get('trace_id') }, 503)
    }
    const parsed = await validateBody(c, ConnectInviteSchema)
    if ('error' in parsed) return parsed.error

    const host = await readKvJson<Team>(c.env.TEAMS_KV, teamDocumentKey(parsed.data.hostTeamId))
    if (!host) {
      return c.json({ ok: false, error: { code: 'not_found', message: 'Host team not found' }, trace_id: c.get('trace_id') }, 404)
    }
    if (!isTeamMember(host, c.get('user').sub)) {
      return c.json({ ok: false, error: { code: 'forbidden', message: 'Not a member of the host team' }, trace_id: c.get('trace_id') }, 403)
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
      return c.json({ ok: false, error: { code: minted.code, message: minted.message }, trace_id: c.get('trace_id') }, 403)
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
      return c.json(
        { ok: false, error: { code: 'bad_request', message: 'teamId required' }, trace_id: c.get('trace_id') },
        400,
      )
    }
    const entries = await listFederationLibrary(c.env.TEAMS_KV, c.env.TEMPLATES_KV, teamId)
    return c.json({ ok: true, data: { entries }, trace_id: c.get('trace_id') })
  })

  parent.route('/api/federation', app)
}
