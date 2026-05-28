/**
 * PUSH-SLA-01 — push delivery SLA metrics (S73).
 */
export type PushSlaSnapshot = {
  targetP99Ms: number
  observedP99Ms: number | null
  deliveryRatePercent: number
  windowHours: number
  status: 'healthy' | 'degraded' | 'unknown'
}

export function computePushSla(counters?: { delivered: number; failed: number; p99Ms?: number }): PushSlaSnapshot {
  const delivered = counters?.delivered ?? 0
  const failed = counters?.failed ?? 0
  const total = delivered + failed
  const rate = total > 0 ? (delivered / total) * 100 : 100
  const observedP99 = counters?.p99Ms ?? null
  const targetP99 = 1000
  let status: PushSlaSnapshot['status'] = 'unknown'
  if (total > 0) {
    status = rate >= 99.5 && (observedP99 === null || observedP99 <= targetP99) ? 'healthy' : 'degraded'
  }
  return {
    targetP99Ms: targetP99,
    observedP99Ms: observedP99,
    deliveryRatePercent: Math.round(rate * 100) / 100,
    windowHours: 24,
    status,
  }
}
