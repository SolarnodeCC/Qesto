/**
 * PARTNER-OAUTH-01 / PARTNER-INTEG-01 — partner app registry + OAuth status.
 */
import { Hono } from 'hono'
import { errorResponse } from '../lib/error-handler'
import { z } from 'zod'
import { authMiddleware, type AuthVariables } from '../middleware/auth'
import { planMiddleware, type PlanVariables } from '../middleware/plan'
import { ulid } from '../lib/ulid'
import { PARTNER_APP_TTL_SECONDS, PARTNER_SECRET_TTL_SECONDS } from '../lib/constants'
import { readKvJson, writeKvJson } from '../lib/kv'
import { validateBody } from '../lib/request-validation'
import { writeEvent } from '../lib/observability'
import type { Env } from '../types'

type Vars = AuthVariables & PlanVariables

export type PartnerApp = {
  id: string
  name: string
  partner: 'workday' | 'jira' | 'mattermost'
  clientId: string
  /** Last four chars of client secret for display only */
  secretHint?: string
  scopes: string[]
  createdAt: number
  teamId: string
  rotatedAt?: number
}

const CreatePartnerAppSchema = z.object({
  name: z.string().min(1).max(120),
  partner: z.enum(['workday', 'jira', 'mattermost']),
  clientId: z.string().min(8).max(256),
  scopes: z.array(z.string()).default(['read_sessions']),
})

function partnerAppKey(appId: string): string {
  return `partner:app:${appId}`
}

function partnerTeamIndexKey(teamId: string): string {
  return `partner:team-index:${teamId}`
}

function partnerSecretKey(appId: string): string {
  return `partner:secret:${appId}`
}

function generatePartnerSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  return `qpa_${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`
}

export function mountPartnerAppRoutes(parent: Hono<{ Bindings: Env; Variables: Vars }>) {
  const app = new Hono<{ Bindings: Env; Variables: Vars }>()
  app.use('*', authMiddleware)
  app.use('*', planMiddleware)

  app.post('/teams/:teamId/partner-apps', async (c) => {
    if (!c.env.INTEGRATIONS_KV) {
      return c.json(
        { ok: false, error: { code: 'unavailable', message: 'Integrations KV not configured' }, trace_id: c.get('trace_id') },
        503,
      )
    }
    const teamId = c.req.param('teamId')
    const validated = await validateBody(c, CreatePartnerAppSchema)
    if ('error' in validated) return validated.error
    const appId = ulid()
    const secret = generatePartnerSecret()
    const record: PartnerApp = {
      id: appId,
      teamId,
      name: validated.data.name,
      partner: validated.data.partner,
      clientId: validated.data.clientId,
      secretHint: secret.slice(-4),
      scopes: validated.data.scopes,
      createdAt: Date.now(),
    }
    await writeKvJson(c.env.INTEGRATIONS_KV, partnerAppKey(appId), record, { expirationTtl: PARTNER_APP_TTL_SECONDS })
    await writeKvJson(
      c.env.INTEGRATIONS_KV,
      partnerSecretKey(appId),
      { secret, rotatedAt: Date.now() },
      { expirationTtl: PARTNER_SECRET_TTL_SECONDS },
    )
    const index = (await readKvJson<string[]>(c.env.INTEGRATIONS_KV, partnerTeamIndexKey(teamId))) ?? []
    index.push(appId)
    await writeKvJson(c.env.INTEGRATIONS_KV, partnerTeamIndexKey(teamId), index, { expirationTtl: PARTNER_APP_TTL_SECONDS })
    return c.json({ ok: true, data: { app: record, clientSecret: secret }, trace_id: c.get('trace_id') }, 201)
  })

  app.post('/teams/:teamId/partner-apps/:appId/rotate-secret', async (c) => {
    if (!c.env.INTEGRATIONS_KV) {
      return c.json(
        { ok: false, error: { code: 'unavailable', message: 'Integrations KV not configured' }, trace_id: c.get('trace_id') },
        503,
      )
    }
    const teamId = c.req.param('teamId')
    const appId = c.req.param('appId')
    const record = await readKvJson<PartnerApp>(c.env.INTEGRATIONS_KV, partnerAppKey(appId))
    if (!record || record.teamId !== teamId) {
      return errorResponse(c, 404, 'not_found', 'Partner app not found')
    }
    const secret = generatePartnerSecret()
    const rotatedAt = Date.now()
    await writeKvJson(
      c.env.INTEGRATIONS_KV,
      partnerSecretKey(appId),
      { secret, rotatedAt },
      { expirationTtl: PARTNER_SECRET_TTL_SECONDS },
    )
    const updated: PartnerApp = { ...record, secretHint: secret.slice(-4), rotatedAt }
    await writeKvJson(c.env.INTEGRATIONS_KV, partnerAppKey(appId), updated, { expirationTtl: PARTNER_APP_TTL_SECONDS })
    writeEvent(c.env.METRICS_AE, {
      name: 'partner.secret_rotated',
      teamId,
      detail: appId,
      userId: c.get('user').sub,
    })
    return c.json({ ok: true, data: { app: updated, clientSecret: secret }, trace_id: c.get('trace_id') })
  })

  app.get('/teams/:teamId/partner-apps', async (c) => {
    if (!c.env.INTEGRATIONS_KV) {
      return c.json({ ok: true, data: { apps: [] }, trace_id: c.get('trace_id') })
    }
    const teamId = c.req.param('teamId')
    const index = (await readKvJson<string[]>(c.env.INTEGRATIONS_KV, partnerTeamIndexKey(teamId))) ?? []
    const apps: PartnerApp[] = []
    for (const id of index) {
      const app = await readKvJson<PartnerApp>(c.env.INTEGRATIONS_KV, partnerAppKey(id))
      if (app) apps.push(app)
    }
    return c.json({ ok: true, data: { apps }, trace_id: c.get('trace_id') })
  })

  parent.route('/api', app)
}
