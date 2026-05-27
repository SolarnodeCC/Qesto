/**
 * ADR-0030 / SLO-ERROR-BUDGET-01 — platform SLO definitions and budget math.
 */
export type SloDefinition = {
  id: string
  name: string
  targetPercent: number
  windowDays: number
  measurement: string
}

export const PLATFORM_SLOS: SloDefinition[] = [
  { id: 'api_availability', name: 'API availability', targetPercent: 99.9, windowDays: 30, measurement: '5xx rate on /api/*' },
  { id: 'vote_latency_p95', name: 'Vote submit p95', targetPercent: 99, windowDays: 7, measurement: 'ws.vote_submitted durationMs p95 < 100ms' },
  { id: 'ws_connect', name: 'WebSocket connect success', targetPercent: 99.5, windowDays: 30, measurement: '101 / upgrade attempts' },
]

export type SloBudgetSnapshot = {
  sloId: string
  targetPercent: number
  observedPercent: number
  errorBudgetRemainingPercent: number
  status: 'healthy' | 'at_risk' | 'exhausted'
  windowDays: number
  computedAt: number
}

/** Deterministic placeholder from KV counters until AE rollups wire in (S66). */
export function computeSloBudgets(
  counters: Partial<Record<string, { ok: number; total: number }>>,
): SloBudgetSnapshot[] {
  const now = Date.now()
  return PLATFORM_SLOS.map((slo) => {
    const c = counters[slo.id] ?? { ok: slo.targetPercent, total: 100 }
    const observed = c.total > 0 ? (c.ok / c.total) * 100 : slo.targetPercent
    const remaining = Math.max(0, observed - (100 - slo.targetPercent))
    const status: SloBudgetSnapshot['status'] =
      observed >= slo.targetPercent ? 'healthy' : observed >= slo.targetPercent - 0.5 ? 'at_risk' : 'exhausted'
    return {
      sloId: slo.id,
      targetPercent: slo.targetPercent,
      observedPercent: Math.round(observed * 100) / 100,
      errorBudgetRemainingPercent: Math.round(remaining * 100) / 100,
      status,
      windowDays: slo.windowDays,
      computedAt: now,
    }
  })
}

export function sloCountersKvKey(): string {
  return 'ops:slo:counters'
}
