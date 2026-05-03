import type { Hono } from 'hono'
import type { AuthVariables } from '../../middleware/auth'
import type { PlanVariables } from '../../middleware/plan'
import type { Env } from '../../types'

export type AiInsightsVars = AuthVariables & PlanVariables

export type AiInsightsApp = Hono<{ Bindings: Env; Variables: AiInsightsVars }>
