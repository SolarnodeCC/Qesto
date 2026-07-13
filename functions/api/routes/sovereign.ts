/**
 * SOVEREIGN+ (ADR-0058 / ADR-0059) — sovereign-tier tenant surface.
 *
 * - GET /api/teams/:id/sovereign/posture            — compliance posture matrix (member).
 * - GET /api/teams/:id/sovereign/audit/export       — signed, verifiable audit export (owner).
 * - GET /api/teams/:id/sovereign/federation-eligibility — exclusion decision (member).
 *
 * Mounted under `/teams` to share the `/api/teams/:id/...` namespace with the
 * other team-scoped routers (pulse, insights). Region/sovereign status comes from
 * config-as-data on the team document (ADR-0058) — no per-tenant code fork.
 */
import { Hono } from 'hono'
import { authMiddleware, type AuthVariables } from '../middleware/auth'
import { planMiddleware, type PlanVariables } from '../middleware/plan'
import { readKvJson } from '../lib/kv'
import { teamDocumentKey } from '../lib/kv-keys'
import { writeEvent } from '../lib/observability'
import { recordAuditEvent } from '../lib/audit'
import { queryAuditEvents } from '../lib/audit'
import { resolveRegion } from '../lib/region-residency'
import { errorResponse } from '../lib/error-handler'
import { buildSovereignPosture } from '../lib/sovereign-posture'
import { assertFederationAllowed, assertEgressAllowed } from '../lib/sovereign-exclusion'
import { buildSignedAuditExport, type SovereignAuditEntry } from '../lib/sovereign-audit-export'
import type { ParentApp } from './parent-app'
import type { Team } from './teams'
import { isTeamMember } from '../lib/authz-helpers'
import type { Env } from '../types'

type Vars = AuthVariables & PlanVariables


function tenantConfig(team: Team) {
  return {
    teamId: team.id,
    regionId: team.regionId ?? null,
    isSovereign: team.isSovereign === true,
    fedrampModerate: team.fedrampModerate === true,
  }
}

export function mountSovereignRoutes(parent: ParentApp) {
  const app = new Hono<{ Bindings: Env; Variables: Vars }>()
  app.use('*', authMiddleware)
  app.use('*', planMiddleware)

  // SOVEREIGN-POSTURE-01 — per-tenant compliance posture matrix.
  app.get('/:id/sovereign/posture', async (c) => {
    const teamId = c.req.param('id')
    const team = await readKvJson<Team>(c.env.TEAMS_KV, teamDocumentKey(teamId))
    if (!team) {
      return errorResponse(c, 404, 'not_found', 'Team not found')
    }
    if (!isTeamMember(team, c.get('user').sub)) {
      return errorResponse(c, 403, 'forbidden', 'Not a member of this team')
    }
    const posture = buildSovereignPosture(tenantConfig(team))
    return c.json({ ok: true, data: { posture }, trace_id: c.get('trace_id') })
  })

  // SOVEREIGN-EXCLUSION-01 — federation/egress eligibility (drives CONNECT join in S95).
  app.get('/:id/sovereign/federation-eligibility', async (c) => {
    const teamId = c.req.param('id')
    const team = await readKvJson<Team>(c.env.TEAMS_KV, teamDocumentKey(teamId))
    if (!team) {
      return errorResponse(c, 404, 'not_found', 'Team not found')
    }
    if (!isTeamMember(team, c.get('user').sub)) {
      return errorResponse(c, 403, 'forbidden', 'Not a member of this team')
    }
    const cfg = tenantConfig(team)
    const federation = assertFederationAllowed(cfg)
    const egress = assertEgressAllowed(cfg)
    return c.json({
      ok: true,
      data: {
        teamId,
        federationAllowed: federation.ok,
        egressAllowed: egress.ok,
        reason: federation.ok ? null : federation.code,
      },
      trace_id: c.get('trace_id'),
    })
  })

  // SOVEREIGN-AUDIT-API-01 — signed, chain-of-custody compliance audit export.
  app.get('/:id/sovereign/audit/export', async (c) => {
    const signingKey = c.env.SOVEREIGN_AUDIT_SIGNING_KEY
    if (!signingKey) {
      return errorResponse(c, 503, 'audit_export_disabled', 'Audit export signing key not configured')
    }

    const teamId = c.req.param('id')
    const team = await readKvJson<Team>(c.env.TEAMS_KV, teamDocumentKey(teamId))
    if (!team) {
      return errorResponse(c, 404, 'not_found', 'Team not found')
    }
    // The audit export is a compliance artifact — owner (DPO proxy) only.
    if (team.ownerId !== c.get('user').sub) {
      return errorResponse(c, 403, 'forbidden', 'Only the team owner can export the audit log')
    }

    // Scope is decided here (never widened downstream): team-owned session subjects.
    const { events } = await queryAuditEvents(c, { subject_type: 'session', limit: 1000 })
    const entries: SovereignAuditEntry[] = events.map((e: Record<string, unknown>) => ({
      id: String(e.id),
      ts: Number(e.ts),
      action: String(e.action),
      subjectType: e.subject_type == null ? null : String(e.subject_type),
      subjectId: e.subject_id == null ? null : String(e.subject_id),
      actorId: e.actor_id == null ? null : String(e.actor_id),
    }))

    const region = resolveRegion(team.regionId).id
    const doc = await buildSignedAuditExport({ teamId, region, entries, signingKey })

    await recordAuditEvent(c, {
      action: 'sovereign.audit.export',
      subject_type: 'team',
      subject_id: teamId,
      after_snapshot: { region, entryCount: doc.entryCount, chainHead: doc.chainHead },
      trace_id: c.get('trace_id'),
    })

    writeEvent(c.env.METRICS_AE, {
      name: 'sovereign.audit_exported',
      userId: c.get('user').sub,
      teamId,
      plan: c.get('plan'),
      count: doc.entryCount,
      traceId: c.get('trace_id'),
    })

    return c.json({ ok: true, data: { export: doc }, trace_id: c.get('trace_id') })
  })

  parent.route('/teams', app)
}
