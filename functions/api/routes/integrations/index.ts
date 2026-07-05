// Integration routes (ADR-0008 IntegrationProvider pattern) — composed from
// per-provider modules. Decomposed from a single 1029-LOC file (#687) so each
// provider's endpoints live in their own module and shared plumbing (state
// token, provider factory, KV helpers) sits in ./shared.
//
// Public surface is preserved: `mountIntegrationRoutes` (app.ts),
// `notify{Slack,Teams}SessionClosed` (queues/consumer.ts), and the config
// helpers/types imported by routes/zoom-embed.ts are all re-exported below.

import { Hono } from 'hono'
import type { Env } from '../../types'
import type { Vars } from './shared'
import { mountSlackRoutes } from './slack'
import { mountTeamsRoutes } from './teams'
import { mountZoomRoutes } from './zoom'
import { mountSalesforceRoutes } from './salesforce'
import { mountNotionRoutes, mountPartnerSkeletons } from './notion'

export function mountIntegrationRoutes(parent: Hono<{ Bindings: Env; Variables: Vars }>) {
  const app = new Hono<{ Bindings: Env; Variables: Vars }>()

  mountSlackRoutes(app)
  mountTeamsRoutes(app)
  mountZoomRoutes(app)
  mountSalesforceRoutes(app)
  mountNotionRoutes(app)
  mountPartnerSkeletons(app)

  parent.route('/api/integrations', app)
}

// ─── Re-exports (preserve the module's prior public API) ──────────────────────
export { notifySlackSessionClosed } from './slack'
export { notifyTeamsSessionClosed } from './teams'
export {
  slackConfigKey,
  teamsConfigKey,
  zoomConfigKey,
  salesforceConfigKey,
  teamsPkceKey,
  type SlackIntegrationConfig,
  type TeamsIntegrationConfig,
  type ZoomIntegrationConfig,
  type SalesforceIntegrationConfig,
} from './shared'
