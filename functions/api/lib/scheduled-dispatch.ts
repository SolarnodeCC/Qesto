/**
 * Table-driven cron dispatcher (DD-32, issue #904).
 *
 * Cloudflare allows at most 5 cron triggers per Worker. The scheduled handler
 * used to be an if/else chain on `event.cron` strings with a hand-copied
 * try/log/alert block per job. Jobs are now rows in a registry: several jobs
 * may share one cron expression, each runs in its own failure domain (a throw
 * is logged + paged and the next job still runs), and adding a job no longer
 * needs a new trigger or new control flow.
 */
import { safeLogContext } from './log'
import { alertCritical } from './alerts'
import type { Env } from '../types'

export type ScheduledJob = {
  /** Stable key; matches ops-cron.ts CRON_REGISTRY where the OPS view tracks it. */
  key: string
  /** Exact cron expression from wrangler.toml [triggers].crons. */
  cron: string
  run: (env: Env) => Promise<string | void>
}

export type ScheduledJobResult = { key: string; ok: boolean; summary?: string }

export async function runScheduledJobs(
  cron: string,
  env: Env,
  jobs: readonly ScheduledJob[],
): Promise<ScheduledJobResult[]> {
  const results: ScheduledJobResult[] = []
  // Sequential on purpose: these jobs share D1/KV and are not latency-bound.
  for (const job of jobs) {
    if (job.cron !== cron) continue
    const traceId = `${job.key}-${Date.now()}`
    try {
      const summary = await job.run(env)
      console.log(`[${job.key}] OK${summary ? ` — ${summary}` : ''}`)
      results.push({ key: job.key, ok: true, ...(summary ? { summary } : {}) })
    } catch (err) {
      const errorClass = err instanceof Error ? err.name : 'ScheduledJobFailed'
      safeLogContext(err, { traceId, route: `worker/${job.key}`, errorClass })
      await alertCritical(env, `worker/${job.key}`, errorClass, { traceId, errorClass })
      results.push({ key: job.key, ok: false })
    }
  }
  return results
}

/** Distinct cron expressions a registry needs — must fit the 5-trigger limit. */
export function requiredCronExpressions(jobs: readonly ScheduledJob[]): string[] {
  return [...new Set(jobs.map((j) => j.cron))]
}
