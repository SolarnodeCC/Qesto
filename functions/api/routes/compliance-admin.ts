/**
 * COMPLIANCE-05 — SOC2 Type II prep status (admin read-only).
 */
import { Hono } from 'hono'
import { authMiddleware, type AuthVariables } from '../middleware/auth'
import { adminMiddleware, type AdminVariables } from '../middleware/admin'
import { writeEvent } from '../lib/observability'
import type { Env } from '../types'

type Vars = AuthVariables & AdminVariables

export type CompliancePrepStatus = {
  soc2Type2: 'prep' | 'in_audit' | 'completed'
  pentest: 'scheduled' | 'in_progress' | 'remediation' | 'resolved'
  controlInventoryComplete: boolean
  evidenceKbPath: string
  updatedAt: number
}

const DEFAULT_STATUS: CompliancePrepStatus = {
  soc2Type2: 'prep',
  pentest: 'scheduled',
  controlInventoryComplete: true,
  evidenceKbPath: 'knowledge-base/security/SOC2_TYPE_II_EVIDENCE',
  updatedAt: Date.now(),
}

export function mountComplianceAdminRoutes(parent: Hono<{ Bindings: Env; Variables: Vars }>) {
  const app = new Hono<{ Bindings: Env; Variables: Vars }>()
  app.use('*', authMiddleware)
  app.use('*', adminMiddleware)

  app.get('/compliance/status', async (c) => {
    writeEvent(c.env.METRICS_AE, {
      name: 'compliance.audit_prep',
      userId: c.get('user').sub,
      detail: 'status_read',
    })
    return c.json({ ok: true, data: { status: DEFAULT_STATUS }, trace_id: c.get('trace_id') })
  })

  app.post('/compliance/pentest/kickoff', async (c) => {
    writeEvent(c.env.METRICS_AE, {
      name: 'compliance.pentest_started',
      userId: c.get('user').sub,
    })
    return c.json({
      ok: true,
      data: { pentest: 'in_progress' as const },
      trace_id: c.get('trace_id'),
    })
  })

  app.post('/compliance/soc2/complete', async (c) => {
    writeEvent(c.env.METRICS_AE, {
      name: 'compliance.soc2_type2_completed',
      userId: c.get('user').sub,
    })
    return c.json({
      ok: true,
      data: { soc2Type2: 'completed' as const, certifiedAt: Date.now() },
      trace_id: c.get('trace_id'),
    })
  })

  app.post('/compliance/pentest/resolve', async (c) => {
    writeEvent(c.env.METRICS_AE, {
      name: 'compliance.pentest_resolved',
      userId: c.get('user').sub,
    })
    return c.json({
      ok: true,
      data: { pentest: 'resolved' as const },
      trace_id: c.get('trace_id'),
    })
  })

  parent.route('/api/admin', app)
}
