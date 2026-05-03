// Auth API — modular registration (Phase 3). Mounted at /api/auth/*.
import { Hono } from 'hono'
import type { Env } from '../../types'
import { registerMagicLinkRoutes } from './magic-link'
import { registerOAuthRoutes } from './oauth'
import { registerPasswordAuthRoutes } from './password'
import { registerSamlRoutes } from './saml'
import { registerAuthSessionRoutes } from './session-routes'
import type { AuthVars } from './types'

export { pwdKey, oauthKey, resetKey, upsertOAuthUser } from './helpers'

export function mountAuthRoutes(parent: any): void {
  const app = new Hono<{ Bindings: Env; Variables: AuthVars }>()

  registerMagicLinkRoutes(app)
  registerAuthSessionRoutes(app)
  registerPasswordAuthRoutes(app)
  registerOAuthRoutes(app)
  registerSamlRoutes(app)

  parent.route('/api/auth', app)
}
