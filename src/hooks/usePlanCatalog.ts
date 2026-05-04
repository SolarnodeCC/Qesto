import { useEffect, useMemo, useState } from 'react'
import { api } from '../api/client'
import { buildPlansFromCatalog, PLANS, type PlanConfig } from '../config/plans'
import type { PlanCatalogApiPayload, PlanCatalogPricingPayload, PlanCatalogApiResponse } from '../types/plan-catalog'

/**
 * Loads `GET /api/plans/catalog` when available; falls back to `PLANS` (from `PLAN_QUOTAS`).
 * Use on marketing surfaces so displayed limits match enforcement after deploys.
 */
export function usePlanCatalog() {
  const [remote, setRemote] = useState<PlanCatalogApiPayload | null>(null)
  const [remotePricing, setRemotePricing] = useState<PlanCatalogPricingPayload | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void api<PlanCatalogApiResponse>('/api/plans/catalog')
      .then((res) => {
        if (res.ok) {
          const { pricing, ...catalog } = res.data
          setRemote(catalog as PlanCatalogApiPayload)
          setRemotePricing(pricing ?? null)
          setError(null)
        } else {
          setError(res.error.message)
        }
      })
      .catch(() => setError('Failed to load plan catalog'))
  }, [])

  const plans = useMemo<PlanConfig[]>(() => {
    if (remote) return buildPlansFromCatalog(remote, remotePricing ?? undefined)
    return PLANS
  }, [remote, remotePricing])

  return {
    plans,
    error,
    hydratedFromApi: remote !== null,
  }
}
