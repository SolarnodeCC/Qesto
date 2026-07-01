/**
 * ENT-MULTI-ORG-01 — Organization hierarchy (KV-backed, Sprint 40).
 *
 * An organization groups multiple teams under one billing/admin umbrella.
 */
import { Hono } from 'hono'
import { z } from 'zod'
import { authMiddleware, type AuthVariables } from '../middleware/auth'
import { planMiddleware, type PlanVariables } from '../middleware/plan'
import { readKvJson, writeKvJson } from '../lib/kv'
import { ulid } from '../lib/ulid'
import { validateBody } from '../lib/request-validation'
import { featureAllowed } from '../lib/entitlements'
import { errorResponse } from '../lib/error-handler'
import type { Env } from '../types'

type Vars = AuthVariables & PlanVariables

export type Organization = {
  id: string
  name: string
  ownerId: string
  teamIds: string[]
  createdAt: number
}

function orgKey(orgId: string): string {
  return `org:${orgId}`
}

function userOrgsKey(userId: string): string {
  return `user-orgs:${userId}`
}

const CreateOrgSchema = z.object({
  name: z.string().min(1).max(120),
  teamIds: z.array(z.string()).max(50).optional(),
})

export function mountOrganizationRoutes(parent: Hono<{ Bindings: Env; Variables: Vars }>) {
  const app = new Hono<{ Bindings: Env; Variables: Vars }>()
  app.use('*', authMiddleware)
  app.use('*', planMiddleware)

  app.post('/', async (c) => {
    const quotas = c.get('planQuotas')
    if (!featureAllowed(quotas, 'samlSso')) {
      return errorResponse(c, 403, 'upgrade_required', 'Organizations require Enterprise (Team) plan')
    }
    if (!c.env.TEAMS_KV) {
      return errorResponse(c, 503, 'kv_unavailable', 'TEAMS_KV not configured')
    }
    const parsed = await validateBody(c, CreateOrgSchema)
    if ('error' in parsed) return parsed.error
    const user = c.get('user')
    const org: Organization = {
      id: ulid(),
      name: parsed.data.name,
      ownerId: user.sub,
      teamIds: parsed.data.teamIds ?? [],
      createdAt: Date.now(),
    }
    await writeKvJson(c.env.TEAMS_KV, orgKey(org.id), org)
    const existing = (await readKvJson<string[]>(c.env.TEAMS_KV, userOrgsKey(user.sub))) ?? []
    if (!existing.includes(org.id)) {
      existing.push(org.id)
      await writeKvJson(c.env.TEAMS_KV, userOrgsKey(user.sub), existing)
    }
    return c.json({ ok: true, data: org, trace_id: c.get('trace_id') }, 201)
  })

  app.get('/:id', async (c) => {
    if (!c.env.TEAMS_KV) {
      return errorResponse(c, 503, 'kv_unavailable', 'TEAMS_KV not configured')
    }
    const org = await readKvJson<Organization>(c.env.TEAMS_KV, orgKey(c.req.param('id')))
    if (!org) {
      return errorResponse(c, 404, 'not_found', 'Organization not found')
    }
    const user = c.get('user')
    if (org.ownerId !== user.sub) {
      return errorResponse(c, 403, 'forbidden', 'Not an organization owner')
    }
    return c.json({ ok: true, data: org, trace_id: c.get('trace_id') })
  })

  parent.route('/api/organizations', app)
}
