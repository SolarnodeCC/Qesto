// CODE-SPLIT — integration routes composed from provider-specific subrouters.
//
// Public surface preserved for external importers:
//   - mountIntegrationRoutes          (app.ts)
//   - notifySlackSessionClosed        (lib/queues/consumer.ts)
//   - notifyTeamsSessionClosed        (lib/queues/consumer.ts)
//   - zoomConfigKey / ZoomIntegrationConfig and other config helpers/types
//     are re-exported below for legacy import paths (e.g. routes/zoom-embed.ts).

import { Hono } from 'hono'
import { authMiddleware } from '../../middleware/auth'
import { createEncryptedTokenStore } from '../../lib/integrations/token-store'
import type { Env } from '../../types'
import { type Vars, resolvePrimaryTeamId } from './shared'
import { mountSlackRoutes } from './slack-routes'
import { mountTeamsRoutes } from './teams-routes'
import { mountZoomRoutes } from './zoom-routes'
import { mountSalesforceRoutes } from './salesforce-routes'
import { mountNotionRoutes } from './notion-routes'

export function mountIntegrationRoutes(parent: Hono<{ Bindings: Env; Variables: Vars }>) {
  const app = new Hono<{ Bindings: Env; Variables: Vars }>()

  mountSlackRoutes(app)
  mountTeamsRoutes(app)
  mountZoomRoutes(app)
  mountSalesforceRoutes(app)
  mountNotionRoutes(app)

  // Partner skeletons (Sprint 45) — status endpoints until full OAuth ships
  for (const partner of ['workday', 'jira', 'mattermost'] as const) {
    app.get(`/${partner}/status`, authMiddleware, async (c) => {
      const store = c.env.INTEGRATIONS_KV ? createEncryptedTokenStore(c.env.INTEGRATIONS_KV, c.env) : null
      const teamId = c.req.query('teamId') ?? (await resolvePrimaryTeamId(c.env, c.get('user').sub))
      const connected =
        store && teamId ? (await store.getToken(teamId, partner)) !== null : false
      return c.json({
        ok: true,
        data: { connected, partner, phase: connected ? 'connected' : 'skeleton' },
        trace_id: c.get('trace_id'),
      })
    })
  }

  parent.route('/api/integrations', app)
}

// ─── Re-exports preserving the pre-split import surface ───────────────────────
export {
  type Vars,
  type SlackIntegrationConfig,
  type TeamsIntegrationConfig,
  type ZoomIntegrationConfig,
  type SalesforceIntegrationConfig,
  slackConfigKey,
  teamsConfigKey,
  zoomConfigKey,
  salesforceConfigKey,
  teamsPkceKey,
} from './shared'

export { notifySlackSessionClosed } from './slack-routes'
export { notifyTeamsSessionClosed } from './teams-routes'
