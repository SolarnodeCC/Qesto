/**
 * Shared `cron_runs` writer for the marketing automation jobs (Content Engine,
 * Mention Monitor, oauth-token-refresh). One row per invocation, matching the
 * existing `cron_runs` table (migrations/0072_ops_control.sql) read by the OPS
 * missed-run dashboard (functions/api/routes/admin/ops-control.ts).
 */

import { ulid } from '../ulid'
import { logBestEffort } from '../log'

export type CronRunStatus = 'success' | 'failure' | 'running'

export async function logCronRun(
  db: D1Database,
  job: string,
  status: CronRunStatus,
  detail?: string,
  startedAt: number = Date.now(),
): Promise<void> {
  try {
    await db
      .prepare(
        `INSERT INTO cron_runs (id, job, status, started_at, finished_at, detail) VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
      )
      .bind(ulid(), job, status, startedAt, Date.now(), detail?.slice(0, 2000) ?? null)
      .run()
  } catch (err) {
    logBestEffort(err, { traceId: 'cron-log', route: 'lib/marketing/cron-log', operation: 'cron_runs.write', details: { job } })
  }
}
