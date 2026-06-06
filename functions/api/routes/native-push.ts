/**
 * NATIVE-PUSH-01 — register / list / revoke native device tokens (Sprint 81).
 */
import { Hono } from 'hono'
import { authMiddleware, type AuthVariables } from '../middleware/auth'
import { validateBody } from '../lib/request-validation'
import {
  newDeviceTokenId,
  RegisterDeviceTokenSchema,
  type DeviceTokenRow,
} from '../lib/native-push'
import type { Env } from '../types'
import type { ParentApp } from './parent-app'

type Vars = AuthVariables

export function mountNativePushRoutes(parent: ParentApp) {
  const app = new Hono<{ Bindings: Env; Variables: Vars }>()
  app.use('*', authMiddleware)

  app.get('/status', (c) => {
    return c.json({
      ok: true,
      data: {
        nativePushEnabled: true,
        platforms: ['ios', 'android'],
        delivery: 'registration_only', // FCM/APNs fan-out lands Sprint 82+
      },
      trace_id: c.get('trace_id'),
    })
  })

  app.get('/tokens', async (c) => {
    const userId = c.get('user').sub
    const rows = await c.env.DB.prepare(
      `SELECT id, platform, app_version, locale, created_at, last_seen_at
         FROM device_tokens
        WHERE user_id = ?1 AND revoked_at IS NULL
        ORDER BY last_seen_at DESC`,
    )
      .bind(userId)
      .all<Pick<DeviceTokenRow, 'id' | 'platform' | 'app_version' | 'locale' | 'created_at' | 'last_seen_at'>>()

    return c.json({
      ok: true,
      data: { tokens: rows.results ?? [] },
      trace_id: c.get('trace_id'),
    })
  })

  app.post('/tokens', async (c) => {
    const parsed = await validateBody(c, RegisterDeviceTokenSchema)
    if ('error' in parsed) return parsed.error

    const userId = c.get('user').sub
    const now = Date.now()
    const id = newDeviceTokenId()
    const { platform, token, appVersion, locale } = parsed.data

    await c.env.DB.prepare(
      `UPDATE device_tokens SET revoked_at = ?1
        WHERE user_id = ?2 AND platform = ?3 AND token = ?4 AND revoked_at IS NULL`,
    )
      .bind(now, userId, platform, token)
      .run()

    await c.env.DB.prepare(
      `INSERT INTO device_tokens (
         id, user_id, platform, token, app_version, locale, created_at, last_seen_at, revoked_at
       ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7, NULL)`,
    )
      .bind(id, userId, platform, token, appVersion ?? null, locale ?? null, now)
      .run()

    return c.json({
      ok: true,
      data: { id, platform, registeredAt: now },
      trace_id: c.get('trace_id'),
    })
  })

  app.delete('/tokens/:tokenId', async (c) => {
    const userId = c.get('user').sub
    const tokenId = c.req.param('tokenId')
    const now = Date.now()

    const result = await c.env.DB.prepare(
      `UPDATE device_tokens SET revoked_at = ?1
        WHERE id = ?2 AND user_id = ?3 AND revoked_at IS NULL`,
    )
      .bind(now, tokenId, userId)
      .run()

    if (!result.meta.changes) {
      return c.json(
        {
          ok: false,
          error: { code: 'not_found', message: 'Device token not found' },
          trace_id: c.get('trace_id'),
        },
        404,
      )
    }

    return c.json({
      ok: true,
      data: { revoked: true, id: tokenId },
      trace_id: c.get('trace_id'),
    })
  })

  parent.route('/api/native/push', app)
}
