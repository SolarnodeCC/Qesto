/**
 * PWA-PUSH-HARDENING-01 — subscribe / status / test notification (S71).
 */
import { Hono } from 'hono'
import { authMiddleware, type AuthVariables } from '../middleware/auth'
import { validateBody } from '../lib/request-validation'
import { computePushSla } from '../lib/push-sla'
import { readKvJson } from '../lib/kv'
import {
  PushSubscriptionSchema,
  deletePushSubscription,
  getVapidPublicKey,
  isPushConfigured,
  loadPushSubscription,
  savePushSubscription,
} from '../lib/pwa-push'
import type { Env } from '../types'

type Vars = AuthVariables

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mountPwaPushRoutes(parent: any) {
  const app = new Hono<{ Bindings: Env; Variables: Vars }>()
  app.use('*', authMiddleware)

  app.get('/sla', async (c) => {
    const counters = c.env.METRICS_KV
      ? await readKvJson<{ delivered: number; failed: number; p99Ms?: number }>(c.env.METRICS_KV, 'push:sla:24h')
      : null
    return c.json({
      ok: true,
      data: { sla: computePushSla(counters ?? undefined) },
      trace_id: c.get('trace_id'),
    })
  })

  app.get('/status', (c) => {
    const configured = isPushConfigured(c.env)
    return c.json({
      ok: true,
      data: {
        pushEnabled: configured,
        vapidPublicKey: configured ? getVapidPublicKey(c.env) : null,
        richActions: true,
        inboxDeepLinks: true,
      },
      trace_id: c.get('trace_id'),
    })
  })

  app.put('/subscription', async (c) => {
    if (!c.env.USERS_KV) {
      return c.json(
        { ok: false, error: { code: 'kv_unavailable', message: 'USERS_KV required' }, trace_id: c.get('trace_id') },
        503,
      )
    }
    const parsed = await validateBody(c, PushSubscriptionSchema)
    if ('error' in parsed) return parsed.error
    const userId = c.get('user').sub
    await savePushSubscription(c.env.USERS_KV, userId, {
      ...parsed.data,
      userAgent: parsed.data.userAgent ?? c.req.header('user-agent')?.slice(0, 512),
    })
    return c.json({ ok: true, data: { saved: true }, trace_id: c.get('trace_id') })
  })

  app.get('/subscription', async (c) => {
    if (!c.env.USERS_KV) {
      return c.json({ ok: true, data: { subscribed: false }, trace_id: c.get('trace_id') })
    }
    const sub = await loadPushSubscription(c.env.USERS_KV, c.get('user').sub)
    return c.json({
      ok: true,
      data: { subscribed: !!sub, endpoint: sub ? `${sub.endpoint.slice(0, 48)}…` : null },
      trace_id: c.get('trace_id'),
    })
  })

  app.delete('/subscription', async (c) => {
    if (c.env.USERS_KV) {
      await deletePushSubscription(c.env.USERS_KV, c.get('user').sub)
    }
    return c.json({ ok: true, data: { deleted: true }, trace_id: c.get('trace_id') })
  })

  parent.route('/api/pwa/push', app)
}
