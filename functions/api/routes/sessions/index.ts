// CODE-SPLIT-01 — session routes composed from subrouters (no behavior change).
import { Hono } from 'hono'
import { authMiddleware } from '../../middleware/auth'
import { planMiddleware } from '../../middleware/plan'
import type { Env } from '../../types'
import type { AuthVariables } from '../../middleware/auth'
import type { PlanVariables } from '../../middleware/plan'
import type { SessionVars } from './shared'
import { fetchSession } from './shared'
import { mountPublicSessionRoutes } from './public'
import { mountSessionCrudRoutes } from './crud'
import { mountLifecycleRoutes } from './lifecycle'
import { mountExportRoutes } from './exports'
import { mountResultsRoutes } from './results'
import { mountSessionWizardRoutes } from './wizard'

type Vars = AuthVariables & PlanVariables

export function mountSessionRoutes(parent: Hono<{ Bindings: Env; Variables: Vars }>) {
  const app = new Hono<{ Bindings: Env; Variables: SessionVars }>()
  const pub = new Hono<{ Bindings: Env; Variables: SessionVars }>()

  mountPublicSessionRoutes(pub)
  parent.route('/api/sessions', pub)

  app.use('*', authMiddleware)
  app.use('*', planMiddleware)

  mountSessionCrudRoutes(app)
  mountLifecycleRoutes(app)
  mountExportRoutes(app, fetchSession)
  mountResultsRoutes(app)
  mountSessionWizardRoutes(app)

  parent.route('/api/sessions', app)
}
