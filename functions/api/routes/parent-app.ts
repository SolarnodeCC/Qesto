import { Hono } from 'hono'
import type { Env } from '../types'
import type { AuthVariables } from '../middleware/auth'
import type { PlanVariables } from '../middleware/plan'
import type { AdminVariables } from '../middleware/admin'
import type { RbacVariables } from '../middleware/rbac'

/** Variables available on the root Hono app passed to mount*Routes(). */
export type ParentVars = AuthVariables &
  PlanVariables &
  Partial<AdminVariables> &
  Partial<RbacVariables> & {
    parent_trace_id?: string
    trace_id?: string
  }

export type ParentApp = Hono<{ Bindings: Env; Variables: ParentVars }>
