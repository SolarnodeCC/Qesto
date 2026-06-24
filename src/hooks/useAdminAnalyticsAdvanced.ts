import { useCallback, useEffect, useState } from 'react'
import { api } from '../api/client'
import { API_BASE_URL } from '../config/api'

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
  const [funnel, setFunnel] = useState<FunnelStep[]>([])
  const [costs, setCosts] = useState<CostData | null>(null)
  const [cohorts, setCohorts] = useState<RetentionCohort[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const q = `window=${window}`
    const [f, c, r] = await Promise.all([
      api<{ funnel: FunnelStep[] }>(`/api/admin/analytics/funnel?${q}`),
      api<CostData>(`/api/admin/analytics/costs?${q}`),
      api<{ cohorts: RetentionCohort[] }>(`/api/admin/analytics/retention?${q}`),
    ])
    if (f.ok) setFunnel(f.data.funnel)
    else setError(f.error.message)
    if (c.ok) setCosts(c.data)
    if (r.ok) setCohorts(r.data.cohorts)
    setLoading(false)
  }, [window])

  useEffect(() => {
    void load()
  }, [load])

  /** Open a CSV export in a new tab for any of the analytics datasets. */
  const exportCsv = useCallback(
    (dataset: 'funnel' | 'costs' | 'retention') => {
      globalThis.open(`${API_BASE_URL}/api/admin/analytics/${dataset}?window=${window}&format=csv`, '_blank', 'noopener')
    },
    [window],
  )

  return { funnel, costs, cohorts, loading, error, refresh: load, exportCsv }
}
