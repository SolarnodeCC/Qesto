import type { Hono } from 'hono'
import { z } from 'zod'
import { authMiddleware } from '../middleware/auth'

const PREFS_TTL = 365 * 24 * 60 * 60 // 1 year

function prefsKey(userId: string) {
  return `prefs:${userId}`
}

const PrefsSchema = z.object({
  density: z.enum(['compact', 'comfortable', 'spacious']).optional(),
})

type UserPrefs = z.infer<typeof PrefsSchema>

export function mountUserRoutes(app: Hono<any>) {
  app.get('/api/users/preferences', authMiddleware, async (c) => {
    const user = c.get('user')
    const raw = await c.env.USERS_KV.get(prefsKey(user.sub))
    let prefs: UserPrefs = {}
    if (raw) {
      try {
        prefs = JSON.parse(raw) as UserPrefs
      } catch (parseErr) {
        console.warn(`[users] failed to parse preferences for user ${user.sub}:`, parseErr)
      }
    }
    return c.json({ ok: true, data: prefs, trace_id: c.get('trace_id') })
  })

  app.patch('/api/users/preferences', authMiddleware, async (c) => {
    const user = c.get('user')
    const body = await c.req.json().catch(() => null)
    const parsed = PrefsSchema.safeParse(body)
    if (!parsed.success) {
      return c.json(
        { ok: false, error: { code: 'bad_request', message: 'Invalid preferences' }, trace_id: c.get('trace_id') },
        400,
      )
    }

    const key = prefsKey(user.sub)
    const existing = await c.env.USERS_KV.get(key)
    let current: UserPrefs = {}
    if (existing) {
      try {
        current = JSON.parse(existing) as UserPrefs
      } catch (parseErr) {
        console.warn(`[users] failed to parse existing preferences for user ${user.sub}:`, parseErr)
      }
    }
    const updated: UserPrefs = { ...current, ...parsed.data }

    await c.env.USERS_KV.put(key, JSON.stringify(updated), { expirationTtl: PREFS_TTL })
    return c.json({ ok: true, data: updated, trace_id: c.get('trace_id') })
  })
}
