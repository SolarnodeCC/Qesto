import { useEffect, useMemo, useState } from 'react'
import { api } from '../api/client'
import { buildPlansFromCatalog, PLANS, type PlanConfig } from '../config/plans'
import type { PlanCatalogApiPayload } from '../types/plan-catalog'

/**
 * Loads `GET /api/plans/catalog` when available; falls back to `PLANS` (from `PLAN_QUOTAS`).
 * Use on marketing surfaces so displayed limits match enforcement after deploys.
 */
export function usePlanCatalog() {
  const [remote, setRemote] = useState<PlanCatalogApiPayload | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void api<PlanCatalogApiPayload>('/api/plans/catalog')
      .then((res) => {
        if (res.ok) {
          setRemote(res.data)
          setError(null)
        } else {
          setError(res.error.message)
        }
      })
      .catch(() => setError('Failed to load plan catalog'))
  }, [])

  const plans = useMemo<PlanConfig[]>(() => {
    if (remote) return buildPlansFromCatalog(remote)
    return PLANS
  }, [remote])

  return {
    plans,
    error,
    hydratedFromApi: remote !== null,
  }
}
