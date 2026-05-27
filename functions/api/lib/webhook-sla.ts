/**
 * WEBHOOK-DELIVERY-SLA-01 — partner webhook delivery SLA (S78).
 */
export type WebhookSlaReport = {
  targetAvailabilityPercent: number
  observedPercent: number
  windowDays: number
  status: 'met' | 'breach' | 'unknown'
}

export function computeWebhookSla(stats?: { delivered: number; failed: number }): WebhookSlaReport {
  const d = stats?.delivered ?? 0
  const f = stats?.failed ?? 0
  const total = d + f
  const observed = total > 0 ? (d / total) * 100 : 100
  const target = 99.95
  return {
    targetAvailabilityPercent: target,
    observedPercent: Math.round(observed * 1000) / 1000,
    windowDays: 28,
    status: total === 0 ? 'unknown' : observed >= target ? 'met' : 'breach',
  }
}
