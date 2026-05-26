// Admin routes — Platform management (Phase 8)
//
// Submodules under ./admin/:
//   metrics, users, audit, kb-sync, help, platform-routes

import { Hono } from 'hono'
import type { AuthVariables } from '../middleware/auth'
import type { AdminVariables } from '../middleware/admin'
import type { PlanVariables } from '../middleware/plan'
import type { RbacVariables } from '../middleware/rbac'
import type { Env } from '../types'
import { registerHelpAdminRoutes } from './admin/help'
import { mountMetricsRoutes } from './admin/metrics'
import { mountUserRoutes } from './admin/users'
import { mountAuditRoutes } from './admin/audit'
import { mountKbSyncRoutes } from './admin/kb-sync'
import { mountPlatformAdminRoutes } from './admin/platform-routes'

export type {
  AdminUser,
  AnalyticsData,
  DailyBucket,
  HourlyCorrelation,
  OpsSummary,
  PlatformKpis,
  ServiceStatus,
  Sprint19Baseline,
} from './admin/types'

type Vars = AuthVariables & PlanVariables & Partial<AdminVariables> & Partial<RbacVariables>

export function mountAdminRoutes(parent: Hono<{ Bindings: Env; Variables: Vars }>) {
  const app = new Hono<{ Bindings: Env; Variables: AuthVariables & AdminVariables }>()

  registerHelpAdminRoutes(app)
  mountMetricsRoutes(app)
  mountUserRoutes(app)
  mountAuditRoutes(app)
  mountKbSyncRoutes(app)
  mountPlatformAdminRoutes(app)

  parent.route('/api/admin', app)
}
