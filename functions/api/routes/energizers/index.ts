
import { Hono } from 'hono'
import { authMiddleware, type AuthVariables } from '../../middleware/auth'
import type { Env } from '../../types'
import { registerEnergizerActiveRoute } from './active'
import { registerEnergizerAdvanceRoutes } from './advance'
import { registerEnergizerDetailRoutes } from './detail'
import { registerEnergizerLeaderboardRoutes } from './leaderboard'
import { registerEnergizerCreateListRoutes } from './create-list'
import { registerEnergizerPatchRoute } from './patch'
import { registerEnergizerVoteNextRoutes } from './vote-next'
import type { ParentApp } from '../parent-app'

type Vars = AuthVariables

export function mountEnergizerRoutes(parent: ParentApp): void {
  const app = new Hono<{ Bindings: Env; Variables: Vars }>()
  app.use('*', authMiddleware)

  registerEnergizerCreateListRoutes(app)
  registerEnergizerActiveRoute(app)
  registerEnergizerPatchRoute(app)
  registerEnergizerVoteNextRoutes(app)
  registerEnergizerAdvanceRoutes(app)
  registerEnergizerDetailRoutes(app)
  registerEnergizerLeaderboardRoutes(app)

  parent.route('/api', app)
}
