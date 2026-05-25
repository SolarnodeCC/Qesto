/**
 * PARTNER-BRANDING-01 — team partner theme for sessions and emails.
 */
import { Hono } from 'hono'
import { z } from 'zod'
import { authMiddleware, type AuthVariables } from '../middleware/auth'
import { planMiddleware, type PlanVariables } from '../middleware/plan'
import { readKvJson, writeKvJson } from '../lib/kv'
import { validateBody } from '../lib/validate'
import type { Env } from '../types'

type Vars = AuthVariables & PlanVariables

export type PartnerBranding = {
  teamId: string
  logoUrl?: string
  primaryColor: string
  accentColor: string
  emailFooter?: string
  updatedAt: number
}

const BrandingSchema = z.object({
  logoUrl: z.string().url().max(512).optional(),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  emailFooter: z.string().max(500).optional(),
})

function brandingKey(teamId: string): string {
  return `partner:branding:${teamId}`
}

export function mountPartnerBrandingRoutes(parent: Hono<{ Bindings: Env; Variables: Vars }>) {
  const app = new Hono<{ Bindings: Env; Variables: Vars }>()
  app.use('*', authMiddleware)
  app.use('*', planMiddleware)

  app.get('/teams/:teamId/partner-branding', async (c) => {
    if (!c.env.INTEGRATIONS_KV) {
      return c.json({ ok: true, data: { branding: null }, trace_id: c.get('trace_id') })
    }
    const teamId = c.req.param('teamId')
    const branding = await readKvJson<PartnerBranding>(c.env.INTEGRATIONS_KV, brandingKey(teamId))
    return c.json({ ok: true, data: { branding }, trace_id: c.get('trace_id') })
  })

  app.put('/teams/:teamId/partner-branding', async (c) => {
    if (!c.env.INTEGRATIONS_KV) {
      return c.json(
        { ok: false, error: { code: 'unavailable', message: 'Branding storage unavailable' }, trace_id: c.get('trace_id') },
        503,
      )
    }
    const teamId = c.req.param('teamId')
    const validated = await validateBody(c, BrandingSchema)
    if ('error' in validated) return validated.error
    const data = validated.data
    const branding: PartnerBranding = {
      teamId,
      primaryColor: data.primaryColor,
      accentColor: data.accentColor,
      updatedAt: Date.now(),
      ...(data.logoUrl !== undefined && { logoUrl: data.logoUrl }),
      ...(data.emailFooter !== undefined && { emailFooter: data.emailFooter }),
    }
    await writeKvJson(c.env.INTEGRATIONS_KV, brandingKey(teamId), branding)
    return c.json({ ok: true, data: { branding }, trace_id: c.get('trace_id') })
  })

  parent.route('/api', app)
}
