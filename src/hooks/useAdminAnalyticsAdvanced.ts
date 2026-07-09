import { useCallback } from 'react'
import { API_BASE_URL } from '../config/api'
import { useParallelApiQuery } from './useApiQuery'

export type AnalyticsWindow = '7d' | '30d' | '90d'

export type FunnelStep = {
  key: string
  label: string
  count: number
  conversion_from_prev_pct: number
  drop_off_pct: number
  conversion_from_top_pct: number
}

export type CostData = {
  window: { start: number; end: number }
  workers_ai: { requests: number; est_tokens: number; est_cost_cents: number; is_estimate: boolean }
  cloudflare_billing: { note: string; services: Array<{ service: string; metric: string; value: number; est_cost_cents: number }> }
}

export type RetentionCohort = { cohort_week: string; signups: number; activated: number; activation_pct: number }

/** Module 5 — advanced analytics, consistent window across funnel/costs/retention. */
export function useAdminAnalyticsAdvanced(window: AnalyticsWindow) {
  const q = `window=${window}`
  const { data, errors, loading, reload } = useParallelApiQuery<{
    funnel: { funnel: FunnelStep[] }
    costs: CostData
    retention: { cohorts: RetentionCohort[] }
  }>({
    funnel: `/api/admin/analytics/funnel?${q}`,
    costs: `/api/admin/analytics/costs?${q}`,
    retention: `/api/admin/analytics/retention?${q}`,
  })

  /** Open a CSV export in a new tab for any of the analytics datasets. */
  const exportCsv = useCallback(
    (dataset: 'funnel' | 'costs' | 'retention') => {
      globalThis.open(`${API_BASE_URL}/api/admin/analytics/${dataset}?window=${window}&format=csv`, '_blank', 'noopener')
    },
    [window],
  )

  return {
    funnel: data.funnel?.funnel ?? [],
    costs: data.costs,
    cohorts: data.retention?.cohorts ?? [],
    loading,
    error: errors.funnel ? errors.funnel.error.message : null,
    refresh: reload,
    exportCsv,
  }
}
