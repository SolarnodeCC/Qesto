import { Hono } from 'hono'
import { authMiddleware, type AuthVariables } from '../middleware/auth'
import { writeEvent } from '../lib/observability'
import { deleteUserGdprData } from '../lib/gdpr-delete-user'
import { ok, fail } from '../lib/http'
import type { Env } from '../types'

type Vars = AuthVariables

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

  parent.route('/api/users', app)
}
