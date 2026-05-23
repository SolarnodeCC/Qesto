/**
 * LDAP-01/02 — directory sync skeleton (full sync ships with enterprise SSO project).
 */
import { Hono } from 'hono'
import { authMiddleware, type AuthVariables } from '../middleware/auth'
import { planMiddleware, type PlanVariables } from '../middleware/plan'
import { featureAllowed } from '../lib/entitlements'
import type { Env } from '../types'

type Vars = AuthVariables & PlanVariables

export function mountLdapRoutes(parent: Hono<{ Bindings: Env; Variables: Vars }>) {
  const app = new Hono<{ Bindings: Env; Variables: Vars }>()
  app.use('*', authMiddleware)
  app.use('*', planMiddleware)

  app.get('/status', async (c) => {
    const configured = Boolean(c.env.LDAP_URL && c.env.LDAP_BIND_DN)
    return c.json({
      ok: true,
      data: { configured, phase: 'skeleton' },
      trace_id: c.get('trace_id'),
    })
  })

  app.post('/sync', async (c) => {
    const quotas = c.get('planQuotas')
    if (!featureAllowed(quotas, 'samlSso')) {
      return c.json(
        { ok: false, error: { code: 'upgrade_required', message: 'LDAP sync requires Enterprise plan' }, trace_id: c.get('trace_id') },
        403,
      )
    }
    if (!c.env.LDAP_URL) {
      return c.json(
        { ok: false, error: { code: 'ldap_not_configured', message: 'LDAP_URL is not configured' }, trace_id: c.get('trace_id') },
        503,
      )
    }
    return c.json(
      {
        ok: false,
        error: { code: 'ldap_sync_pending', message: 'Directory sync worker not implemented yet' },
        trace_id: c.get('trace_id'),
      },
      501,
    )
  })

  parent.route('/api/ldap', app)
}
