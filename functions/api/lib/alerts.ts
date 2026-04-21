// Threshold-based alert detection.
//
// Called by the scheduled summariser (`worker/`) once per minute. Returns a
// structured alert when any of the SLO thresholds are breached so the worker
// can emit a WARN-level log line, page Ops via Logpush, and push to D1 for
// dashboard roll-up.
//
// Thresholds (v1 — tune after two weeks of baseline data):
//   • p95 latency > 500ms      (SLO: 95% of requests serve in <500ms)
//   • error_rate  > 5%         (5xx / total)
//   • DO crash                 (surfaced via do_crash flag)
//
// The alert message is English-only, operator-facing — NO user data, NO PII.

export const ALERT_THRESHOLDS = {
  p95LatencyMs: 500,
  errorRate: 0.05,
} as const

export type AlertInput = {
  route: string
  p95_latency: number
  error_rate: number
  do_crash?: boolean
  request_count?: number
}

export type AlertResult = {
  fired: boolean
  severity: 'none' | 'warn' | 'critical'
  reasons: string[]
  message: string
}

/**
 * Evaluate alert thresholds for a single (route, minute) bucket.
 * DO crash escalates to `critical`; latency or error rate breaches are `warn`
 * unless both fire simultaneously (compound failure → `critical`).
 */
export function checkAlert(
  route: string,
  p95_latency: number,
  error_rate: number,
  opts: { do_crash?: boolean; request_count?: number } = {},
): AlertResult {
  const reasons: string[] = []

  if (p95_latency > ALERT_THRESHOLDS.p95LatencyMs) {
    reasons.push(`p95=${Math.round(p95_latency)}ms > ${ALERT_THRESHOLDS.p95LatencyMs}ms`)
  }
  if (error_rate > ALERT_THRESHOLDS.errorRate) {
    // Format as integer percent to avoid float noise in logs.
    const pct = Math.round(error_rate * 1000) / 10
    reasons.push(`error_rate=${pct}% > ${ALERT_THRESHOLDS.errorRate * 100}%`)
  }
  if (opts.do_crash) {
    reasons.push('durable_object_crash')
  }

  if (reasons.length === 0) {
    return { fired: false, severity: 'none', reasons: [], message: '' }
  }

  const severity: AlertResult['severity'] =
    opts.do_crash || reasons.length >= 2 ? 'critical' : 'warn'

  const sampleSuffix =
    typeof opts.request_count === 'number' ? ` (n=${opts.request_count})` : ''
  const message = `[${severity}] route=${route} ${reasons.join('; ')}${sampleSuffix}`

  return { fired: true, severity, reasons, message }
}

/** Convenience wrapper that also accepts the AlertInput shape. */
export function checkAlertInput(input: AlertInput): AlertResult {
  return checkAlert(input.route, input.p95_latency, input.error_rate, {
    do_crash: input.do_crash,
    request_count: input.request_count,
  })
}
