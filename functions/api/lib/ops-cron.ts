// Platformbeheer Module 4 (OPS) — cron registry + missed-run detection.
//
// Pure logic, no bindings, so the alerting rule is unit-testable. The registry
// maps each known scheduled job to its expected cadence; the OPS view compares
// the latest run to that cadence and flags a miss within the grace window.

export type CronJob = {
  /** Stable key written to cron_runs.job by the scheduled worker. */
  key: string
  label: string
  /** The cron expression as configured in wrangler.toml (display only). */
  schedule: string
  /** Expected interval between runs, in ms — used for the missed-run check. */
  intervalMs: number
}

const DAY = 24 * 60 * 60 * 1000
const WEEK = 7 * DAY
const HOUR = 60 * 60 * 1000

// Sourced from wrangler.toml [triggers].crons plus known automation workers.
export const CRON_REGISTRY: CronJob[] = [
  { key: 'kb-watchdog', label: 'KB vector retrieval watchdog', schedule: '0 2 * * *', intervalMs: DAY },
  // Cloudflare cron day-of-week is 1=Sunday … 7=Saturday (not the standard 0=Sunday).
  { key: 'kb-weekly', label: 'KB weekly maintenance', schedule: '0 3 * * 1', intervalMs: WEEK },
  { key: 'linkedin-automation', label: 'LinkedIn content automation', schedule: '0 8 * * *', intervalMs: DAY },
  // Marketing automation (absorbs linkedin-automation going forward; left running during transition).
  { key: 'content-engine', label: 'Marketing content engine', schedule: '0 6 * * 3,5,7', intervalMs: 2.5 * DAY },
  { key: 'mention-monitor', label: 'Marketing mention monitor', schedule: '0 */3 * * *', intervalMs: 3 * HOUR },
  { key: 'oauth-token-refresh', label: 'Marketing OAuth token refresh', schedule: '0 4 * * *', intervalMs: DAY },
]

/** Grace period before a late run is considered missed (AC: alert ≤ 1 min late). */
export const MISSED_RUN_GRACE_MS = 60 * 1000

/**
 * True when the job is overdue: no successful run within its interval + grace.
 * A null lastRunTs (never run, or run record missing) counts as missed.
 */
export function isCronMissed(
  lastRunTs: number | null,
  intervalMs: number,
  now: number,
  graceMs: number = MISSED_RUN_GRACE_MS,
): boolean {
  if (lastRunTs === null) return true
  return now - lastRunTs > intervalMs + graceMs
}

/** Next expected run time from the last run + interval. */
export function nextRunAfter(lastRunTs: number | null, intervalMs: number, now: number): number {
  if (lastRunTs === null) return now
  return lastRunTs + intervalMs
}
