// Energizers API — modular registration (PR-D). Behaviour matches legacy single-file router.
import { Hono } from 'hono'
import { authMiddleware, type AuthVariables } from '../../middleware/auth'
import type { Env } from '../../types'
import { registerEnergizerActiveRoute } from './active'
import { registerEnergizerAdvanceDetailLeaderboardRoutes } from './advance-detail-leaderboard'
import { registerEnergizerCreateListRoutes } from './create-list'
import { registerEnergizerPatchRoute } from './patch'
import { registerEnergizerVoteNextRoutes } from './vote-next'

type Vars = AuthVariables

export function mountEnergizerRoutes(parent: any): void {
  const app = new Hono<{ Bindings: Env; Variables: Vars }>()
  app.use('*', authMiddleware)

  registerEnergizerCreateListRoutes(app)
  registerEnergizerActiveRoute(app)
  registerEnergizerPatchRoute(app)
  registerEnergizerVoteNextRoutes(app)
  registerEnergizerAdvanceDetailLeaderboardRoutes(app)

  parent.route('/api', app)
}
