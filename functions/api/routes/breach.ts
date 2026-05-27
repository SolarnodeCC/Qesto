/**
 * SEC-BREACH-01 — GDPR Art. 33 breach notification automation stub (S79).
 */
import { Hono } from 'hono'
import { authMiddleware, type AuthVariables } from '../middleware/auth'
import { adminMiddleware, type AdminVariables } from '../middleware/admin'
import type { Env } from '../types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mountBreachRoutes(parent: any) {
  const admin = new Hono<{ Bindings: Env; Variables: AuthVariables & AdminVariables }>()
  admin.use('*', authMiddleware)
  admin.use('*', adminMiddleware)

  admin.post('/report', async (c) => {
    const body = await c.req.json<{ summary?: string }>().catch(() => ({}))
    return c.json({
      ok: true,
      data: {
        reported: true,
        ticketId: `breach-${Date.now()}`,
        summary: body.summary ?? 'Automated breach workflow initiated',
        regulatorNotifyWithinHours: 72,
      },
      trace_id: c.get('trace_id'),
    })
  })

  parent.route('/api/admin/breach', admin)
}
