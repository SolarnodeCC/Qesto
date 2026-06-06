// CODE-SPLIT-02 — wizard routes composed from submodules (no behavior change).
import { Hono } from 'hono'
import type { Env } from '../../../types'
import type { SessionVars } from '../shared'
import { mountWizardAIRoutes } from './ai'
import { mountWizardQuestionRoutes } from './questions'
import { mountWizardSessionOpsRoutes } from './session-ops'
import { mountWizardInsightsRoutes } from './insights'

export function mountSessionWizardRoutes(app: Hono<{ Bindings: Env; Variables: SessionVars }>) {
  mountWizardAIRoutes(app)
  mountWizardQuestionRoutes(app)
  mountWizardSessionOpsRoutes(app)
  mountWizardInsightsRoutes(app)
}
