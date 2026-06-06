// CODE-SHAPE: session lifecycle routes composed from focused modules.
import type { Hono } from 'hono'
import type { Env } from '../../../types'
import type { SessionVars } from '../shared'
import { registerStartRoute } from './start'
import { registerCloseRoute } from './close'

export function mountLifecycleRoutes(app: Hono<{ Bindings: Env; Variables: SessionVars }>) {
  registerStartRoute(app)
  registerCloseRoute(app)
}
