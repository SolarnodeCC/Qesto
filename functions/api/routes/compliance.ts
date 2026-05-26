/**
 * COMPLIANCE-TYPE2-EVIDENCE-01 — evidence pack metadata for enterprise admins.
 */
import { Hono } from 'hono'
import { authMiddleware, type AuthVariables } from '../middleware/auth'
import type { AdminVariables } from '../middleware/admin'
import { adminMiddleware } from '../middleware/admin'
import type { Env } from '../types'
import type { PlanVariables } from '../middleware/plan'
import type { RbacVariables } from '../middleware/rbac'

type Vars = AuthVariables & PlanVariables & Partial<AdminVariables> & Partial<RbacVariables>

export function mountComplianceRoutes(parent: Hono<{ Bindings: Env; Variables: Vars }>) {
  const app = new Hono<{ Bindings: Env; Variables: AuthVariables & AdminVariables }>()
  app.use('*', authMiddleware)
  app.use('*', adminMiddleware)

  app.get('/evidence-pack', async (c) => {
    const generatedAt = Date.now()
    return c.json({
      ok: true,
      data: {
        generatedAt,
        framework: 'SOC2-Type-II-prep',
        artifacts: [
          { id: 'access-control', status: 'automated', source: 'rbac-matrix' },
          { id: 'audit-trail', status: 'automated', source: 'AUDIT_KV' },
          { id: 'gdpr-deletion', status: 'automated', source: 'gdpr.deletion_* events' },
          { id: 'api-key-lifecycle', status: 'automated', source: 'INTEGRATIONS_KV apikey:*' },
          { id: 'pentest-remediation', status: 'manual_upload', source: 'security/backlog' },
        ],
        retentionDays: 365,
        note: 'Full PDF export is enterprise roadmap; this endpoint lists verifiable control sources.',
      },
      trace_id: c.get('trace_id'),
    })
  })

  parent.route('/api/compliance', app)
}
