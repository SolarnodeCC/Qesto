import { Hono } from 'hono'
import { authMiddleware, type AuthVariables } from '../middleware/auth'
import type { PlanVariables } from '../middleware/plan'
import type { AdminVariables } from '../middleware/admin'
import type { RbacVariables } from '../middleware/rbac'
import { writeEvent } from '../lib/observability'
import { deleteUserGdprData } from '../lib/gdpr-delete-user'
import { ok } from '../lib/http'
import type { Env } from '../types'

// Match the Vars shape used in app.ts so this sub-router composes cleanly.
type Vars = AuthVariables & PlanVariables & Partial<AdminVariables> & Partial<RbacVariables>

export function mountGdprRoutes(parent: Hono<{ Bindings: Env; Variables: Vars }>) {
  const app = new Hono<{ Bindings: Env; Variables: Vars }>()

  app.delete('/me/gdpr-delete', authMiddleware, async (c) => {
    const user = c.get('user')
    const traceId = c.get('trace_id')

    writeEvent(c.env.METRICS_AE, {
      name: 'gdpr.deletion_requested',
      userId: user.sub,
      traceId,
    })

    const result = await deleteUserGdprData(
      {
        DB: c.env.DB,
        USERS_KV: c.env.USERS_KV,
        TEAMS_KV: c.env.TEAMS_KV,
        SESSIONS_KV: c.env.SESSIONS_KV,
      },
      user.sub,
    )

    writeEvent(c.env.METRICS_AE, {
      name: 'gdpr.deletion_completed',
      userId: user.sub,
      traceId,
      count: result.sessionsDeleted,
    })

    return ok(c, {
      deleted: true,
      sessionsDeleted: result.sessionsDeleted,
      userRowDeleted: result.userRowDeleted,
    })
  })

  app.get('/me/data-export', authMiddleware, async (c) => {
    const user = c.get('user')
    const sessions = await c.env.DB.prepare(
      `SELECT id, title, status, created_at, closed_at FROM sessions WHERE owner_id = ?1 ORDER BY created_at DESC LIMIT 500`,
    )
      .bind(user.sub)
      .all()
    const profile = await c.env.DB.prepare(`SELECT id, email, created_at FROM users WHERE id = ?1`)
      .bind(user.sub)
      .first()
    return ok(c, {
      exportedAt: Date.now(),
      format: 'json-portability-v1',
      profile: profile ?? { id: user.sub, email: user.email },
      sessions: sessions.results ?? [],
      note: 'Machine-readable GDPR portability export; does not include vote-level PII for team anonymity modes.',
    })
  })

  parent.route('/api/users', app)
}
