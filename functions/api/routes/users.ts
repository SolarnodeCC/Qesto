import type { Hono } from 'hono'
import { z } from 'zod'
import { authMiddleware } from '../middleware/auth'
import { readKvJson, writeKvJson } from '../lib/kv'
import { ok, fail } from '../lib/http'
import { PREFS_TTL_SECONDS } from '../lib/constants'

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
    const prefs = (await readKvJson<UserPrefs>(c.env.USERS_KV, prefsKey(user.sub))) ?? {}
    return ok(c, prefs)
  })

  app.patch('/api/users/preferences', authMiddleware, async (c) => {
    const user = c.get('user')
    const body = await c.req.json().catch(() => null)
    const parsed = PrefsSchema.safeParse(body)
    if (!parsed.success) {
      return fail(c, 'bad_request', 'Invalid preferences', 400)
    }

    const key = prefsKey(user.sub)
    const current = (await readKvJson<UserPrefs>(c.env.USERS_KV, key)) ?? {}
    const updated: UserPrefs = { ...current, ...parsed.data }

    await writeKvJson(c.env.USERS_KV, key, updated, { expirationTtl: PREFS_TTL_SECONDS })
    return ok(c, updated)
  })
}
