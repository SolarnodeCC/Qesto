import type { Hono } from 'hono'
import type { AuthVariables } from '../../middleware/auth'
import type { PlanVariables } from '../../middleware/plan'
import type { Env } from '../../types'

export type AuthVars = AuthVariables & PlanVariables

export type AuthApp = Hono<{ Bindings: Env; Variables: AuthVars }>
