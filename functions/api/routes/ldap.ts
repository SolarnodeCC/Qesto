/**
 * LDAP-01/02 — directory sync (mock + HTTP bridge).
 */
import { Hono } from 'hono'
import { z } from 'zod'
import { authMiddleware, type AuthVariables } from '../middleware/auth'
import { planMiddleware, type PlanVariables } from '../middleware/plan'
import { featureAllowed } from '../lib/entitlements'
import { fetchLdapDirectory, syncLdapDirectoryToTeam } from '../lib/ldap-sync'
import {
  loadLdapGroupMap,
  saveLdapGroupMap,
  ldapFilterKey,
  type LdapGroupMap,
  type LdapSyncFilter,
} from '../lib/ldap-group-map'
import { readKvJson, writeKvJson } from '../lib/kv'
import { recordAuditEvent } from '../lib/audit'
import { validateBody } from '../lib/validate'
import { safeLogContext } from '../lib/log'
import type { Env } from '../types'

type Vars = AuthVariables & PlanVariables

const LdapSyncBodySchema = z.object({
  teamId: z.string().min(1).optional(),
  dryRun: z.boolean().optional(),
})

export function mountLdapRoutes(parent: Hono<{ Bindings: Env; Variables: Vars }>) {
  const app = new Hono<{ Bindings: Env; Variables: Vars }>()
  app.use('*', authMiddleware)
  app.use('*', planMiddleware)

  app.get('/status', async (c) => {
    const mock = c.env.LDAP_SYNC_MOCK === 'true' || c.env.LDAP_URL === 'mock://ldap'
    const bridge = Boolean(c.env.LDAP_BRIDGE_URL?.trim())
    const configured = mock || bridge || Boolean(c.env.LDAP_URL && c.env.LDAP_BIND_DN)
    return c.json({
      ok: true,
      data: {
        configured,
        phase: configured ? 'sync_ready' : 'unconfigured',
        mode: mock ? 'mock' : bridge ? 'bridge' : configured ? 'ldap_url' : 'none',
      },
      trace_id: c.get('trace_id'),
    })
  })

  app.post('/sync', async (c) => {
    const traceId = c.get('trace_id')
    const quotas = c.get('planQuotas')
    if (!featureAllowed(quotas, 'samlSso')) {
      return c.json(
        { ok: false, error: { code: 'upgrade_required', message: 'LDAP sync requires Enterprise plan' }, trace_id: traceId },
        403,
      )
    }

    const validated = await validateBody(c, LdapSyncBodySchema)
    if ('error' in validated) return validated.error
    const teamId = validated.data.teamId ?? c.env.LDAP_TEAM_ID
    if (!teamId) {
      return c.json(
        { ok: false, error: { code: 'validation', message: 'teamId required (body or LDAP_TEAM_ID)' }, trace_id: traceId },
        400,
      )
    }

    try {
      const entries = await fetchLdapDirectory(c.env)
      if (validated.data.dryRun) {
        return c.json({
          ok: true,
          data: { dryRun: true, wouldSync: entries.length, teamId },
          trace_id: traceId,
        })
      }
      const filter = (await readKvJson<LdapSyncFilter>(c.env.TEAMS_KV, ldapFilterKey(teamId))) ?? {}
      const groupMap = await loadLdapGroupMap(c.env.TEAMS_KV, teamId)
      const result = await syncLdapDirectoryToTeam(c.env.DB, c.env.TEAMS_KV, teamId, entries, {
        filter,
        groupMap,
      })
      await recordAuditEvent(c, {
        action: 'ldap.sync.completed',
        subject_type: 'team',
        subject_id: teamId,
        after_snapshot: result,
      })
      return c.json({ ok: true, data: result, trace_id: traceId })
    } catch (err) {
      safeLogContext('ldap_sync_failed', { teamId, err: err instanceof Error ? err.message : 'unknown' })
      const message = err instanceof Error ? err.message : 'ldap_sync_failed'
      const code =
        message === 'team_not_found'
          ? 'not_found'
          : message === 'ldap_provider_unconfigured'
            ? 'ldap_not_configured'
            : 'ldap_sync_failed'
      const status = code === 'not_found' ? 404 : code === 'ldap_not_configured' ? 503 : 502
      return c.json(
        {
          ok: false,
          error: {
            code,
            message,
          },
          trace_id: traceId,
        },
        status,
      )
    }
  })

  app.put('/teams/:teamId/group-map', async (c) => {
    const teamId = c.req.param('teamId')
    const body = (await c.req.json().catch(() => null)) as LdapGroupMap | null
    if (!body || typeof body !== 'object') {
      return c.json(
        { ok: false, error: { code: 'validation', message: 'Invalid group map' }, trace_id: c.get('trace_id') },
        400,
      )
    }
    await saveLdapGroupMap(c.env.TEAMS_KV, teamId, body)
    return c.json({ ok: true, data: { teamId, map: body }, trace_id: c.get('trace_id') })
  })

  app.get('/onboard', async (c) => {
    return c.json({
      ok: true,
      data: {
        steps: [
          { id: 'status', title: 'Check LDAP connectivity', route: 'GET /api/ldap/status' },
          { id: 'filter', title: 'Configure OU/group filter', route: 'PUT /api/ldap/teams/:teamId/filter' },
          { id: 'group-map', title: 'Map LDAP groups to roles', route: 'PUT /api/ldap/teams/:teamId/group-map' },
          { id: 'dry-run', title: 'Dry-run sync', route: 'POST /api/ldap/sync { dryRun: true }' },
          { id: 'sync', title: 'Run production sync', route: 'POST /api/ldap/sync' },
        ],
      },
      trace_id: c.get('trace_id'),
    })
  })

  app.put('/teams/:teamId/filter', async (c) => {
    const teamId = c.req.param('teamId')
    const body = (await c.req.json().catch(() => null)) as LdapSyncFilter | null
    if (!body) {
      return c.json(
        { ok: false, error: { code: 'validation', message: 'Invalid filter' }, trace_id: c.get('trace_id') },
        400,
      )
    }
    await writeKvJson(c.env.TEAMS_KV, ldapFilterKey(teamId), body)
    return c.json({ ok: true, data: { teamId, filter: body }, trace_id: c.get('trace_id') })
  })

  parent.route('/api/ldap', app)
}
