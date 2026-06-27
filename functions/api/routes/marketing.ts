// Marketing Automation routes — single-owner internal tool (Content Engine
// review, Mention Monitor feed, Content Calendar CRUD, Video Asset Library,
// OAuth token health). Every route is gated by marketingOwnerMiddleware
// (SUPERUSER_EMAIL exact match only — see middleware/marketing-owner.ts),
// except /video-assets/:id/stream, whose signed HMAC token is its own auth.

import { Hono } from 'hono'
import type { AuthVariables } from '../middleware/auth'
import type { MarketingOwnerVariables } from '../middleware/marketing-owner'
import type { Env } from '../types'
import { mountContentItemsRoutes } from './marketing/content-items'
import { mountMentionsRoutes } from './marketing/mentions'
import { mountCalendarRoutes } from './marketing/calendar'
import { mountVideoAssetsRoutes } from './marketing/video-assets'
import { mountOauthStatusRoutes } from './marketing/oauth-status'
import type { ParentApp } from './parent-app'

export function mountMarketingRoutes(parent: ParentApp) {
  const app = new Hono<{ Bindings: Env; Variables: AuthVariables & MarketingOwnerVariables }>()

  mountContentItemsRoutes(app)
  mountMentionsRoutes(app)
  mountCalendarRoutes(app)
  mountVideoAssetsRoutes(app)
  mountOauthStatusRoutes(app)

  parent.route('/api/marketing', app)
}
