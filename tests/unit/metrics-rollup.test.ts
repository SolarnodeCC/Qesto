/**
 * Requirement: ADR-0030 (SLOs & error budgets) — request metrics reach metrics_summary so SLO paging can fire.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import {
  __resetMetricsRollup,
  flushMetricsSnapshot,
  recordRequestMetric,
  takeMetricsSnapshot,
  METRICS_FLUSH_INTERVAL_MS,
} from '../../functions/api/lib/metrics-rollup'
import type { Env } from '../../functions/api/types'

beforeEach(() => __resetMetricsRollup())

describe('metrics rollup', () => {
  it('only flushes once per interval (no per-request writes)', () => {
    const t0 = Date.now()
    recordRequestMetric('/api/sessions', 20, false, t0)
    expect(takeMetricsSnapshot(t0 + 10)).toBeNull()
    recordRequestMetric('/api/sessions', 40, true, t0 + 20)
    const snap = takeMetricsSnapshot(t0 + METRICS_FLUSH_INTERVAL_MS + 1)!
    const row = snap.rows.find((r) => r.route === '/api/sessions')!
    expect(row.count).toBe(2)
    expect(row.errors).toBe(1)
    expect(snap.live.count).toBe(2)
    // Accumulator detached: the next interval starts empty.
    expect(takeMetricsSnapshot(t0 + 2 * METRICS_FLUSH_INTERVAL_MS + 2)).toBeNull()
  })

  it('writes one additive metrics_summary upsert per route and one KV merge', async () => {
    const sql: string[] = []
    const binds: unknown[][] = []
    let kvPuts = 0
    const env = {
      DB: {
        prepare: (q: string) => { sql.push(q); return { bind: (...a: unknown[]) => { binds.push(a); return {} } } },
        batch: async () => [],
      },
      METRICS_KV: { get: async () => null, put: async () => { kvPuts++ } },
    } as unknown as Env
    recordRequestMetric('/api/a', 10, false)
    recordRequestMetric('/api/a', 30, true)
    recordRequestMetric('/api/b', 5, false)
    await flushMetricsSnapshot(env, takeMetricsSnapshot(Date.now(), true)!)
    expect(sql[0]).toContain('ON CONFLICT(id) DO UPDATE')
    expect(binds).toHaveLength(2)
    const a = binds.find((b) => b[2] === '/api/a')!
    expect(a[6]).toBe(1) // error_count
    expect(a[7]).toBe(2) // request_count
    expect(kvPuts).toBe(1)
  })
})
