// Marketing Review Dashboard — OAuth token health (LinkedIn/Reddit/YouTube),
// backed by oauth_token_status which the daily proactive-refresh cron keeps current.

import { Hono } from 'hono'
import { authMiddleware, type AuthVariables } from '../../middleware/auth'
import { marketingOwnerMiddleware, type MarketingOwnerVariables } from '../../middleware/marketing-owner'
import { getTokenStatusSnapshot } from '../../lib/marketing/token-status'
import type { Env } from '../../types'

type App = Hono<{ Bindings: Env; Variables: AuthVariables & MarketingOwnerVariables }>

export function mountOauthStatusRoutes(app: App) {
  app.get('/oauth-status', authMiddleware, marketingOwnerMiddleware, async (c) => {
    const trace_id = c.get('trace_id')
    const platforms = await getTokenStatusSnapshot(c.env.DB)
    return c.json({ ok: true, data: { platforms }, trace_id }, 200)
  })
}
