/**
 * OPS-ALERTS-PAGING-01 — evaluate recent metrics_summary buckets and page on critical SLO breaches.
 */
import { checkAlert } from './alerts'
import { dispatchOperatorAlert, type AlertPagingEnv } from './alert-paging'
import type { Env } from '../types'
import { logEvent } from './log'

/** Minimum requests per route-hour before an SLO breach can page. */
export const MIN_REQUESTS_TO_JUDGE = 20

export type MetricsSweepResult = {
  scanned: number
  critical: number
}

export async function runMetricsAlertSweep(env: Pick<Env, 'DB'> & AlertPagingEnv): Promise<MetricsSweepResult> {
  const since1h = Date.now() - 60 * 60 * 1000
  let scanned = 0
  let critical = 0

  try {
    // Rows are per (5-min bucket, route, isolate) — aggregate per route over
    // the last hour, and ignore routes with too little traffic to judge.
    const { results } = await env.DB.prepare(
      `SELECT route,
              SUM(request_count) AS request_count,
              SUM(error_count)   AS error_count,
              MAX(p95_ms)        AS p95_ms
         FROM metrics_summary
        WHERE bucket_ts >= ?1
        GROUP BY route
       HAVING SUM(request_count) >= ?2
        ORDER BY SUM(error_count) DESC
        LIMIT 120`,
    )
      .bind(since1h, MIN_REQUESTS_TO_JUDGE)
      .all<{
        route: string
        request_count: number
        error_count: number
        p95_ms: number | null
      }>()

    for (const row of results ?? []) {
      scanned++
      const errorRate = row.request_count > 0 ? row.error_count / row.request_count : 0
      const p95 = row.p95_ms ?? 0
      const alert = checkAlert(row.route, p95, errorRate, {
        request_count: row.request_count,
      })
      if (alert.severity === 'critical') {
        critical++
        await dispatchOperatorAlert(env, alert)
      }
    }
  } catch (err) {
    // Used to be a bare `catch {}` that reported "scanned 0, critical 0" as a
    // success while paging was silently dead. Surface it so the cron job fails.
    logEvent({ event: 'metrics_alert_sweep.failed', error: err instanceof Error ? err.message : String(err) }, 'error')
    throw err
  }

  return { scanned, critical }
}
