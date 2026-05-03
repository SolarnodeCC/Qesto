import type { Hono } from 'hono'
import type { AuthVariables } from '../../middleware/auth'
import type { Env } from '../../types'

/** Sub-router type for energizer HTTP handlers (PR-D modularization). */
export type EnergizerApp = Hono<{ Bindings: Env; Variables: AuthVariables }>
