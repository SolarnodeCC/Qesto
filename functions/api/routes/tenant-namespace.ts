/**
 * EDGE-NAMESPACE-ISOLATION-01 — tenant isolation metadata (S77).
 */
import { Hono } from 'hono'
import { authMiddleware, type AuthVariables } from '../middleware/auth'
import { describeTenantNamespace } from '../lib/tenant-namespace'
import type { Env } from '../types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mountTenantNamespaceRoutes(parent: any) {
  const app = new Hono<{ Bindings: Env; Variables: AuthVariables }>()
  app.use('*', authMiddleware)

  app.get('/teams/:teamId', (c) => {
    const teamId = c.req.param('teamId')
    return c.json({
      ok: true,
      data: { namespace: describeTenantNamespace(teamId) },
      trace_id: c.get('trace_id'),
    })
  })

  parent.route('/api/platform/tenant-namespace', app)
}
