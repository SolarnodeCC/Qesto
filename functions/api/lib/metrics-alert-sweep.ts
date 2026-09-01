/**
 * OPS-ALERTS-PAGING-01 — evaluate recent metrics_summary buckets and page on critical SLO breaches.
 */
import { checkAlert } from './alerts'
import { dispatchOperatorAlert, type AlertPagingEnv } from './alert-paging'
import type { Env } from '../types'

export type MetricsSweepResult = {
  scanned: number
  critical: number
}

export async function runMetricsAlertSweep(env: Pick<Env, 'DB'> & AlertPagingEnv): Promise<MetricsSweepResult> {
  const since1h = Date.now() - 60 * 60 * 1000
  let scanned = 0
  let critical = 0

  try {
    const { results } = await env.DB.prepare(
      `SELECT route, request_count, error_count, p95_ms
         FROM metrics_summary
        WHERE bucket_ts >= ?1 AND request_count > 0
        ORDER BY bucket_ts DESC
        LIMIT 120`,
    )
      .bind(since1h)
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
  } catch {
    /* metrics_summary optional in local dev */
  }

  return { scanned, critical }
}
