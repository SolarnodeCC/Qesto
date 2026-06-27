/**
 * KV TTL mutex for cron job idempotency (Content Engine / Mention Monitor).
 * Best-effort, not CAS-based — acceptable because cron invocations for a given
 * job are minutes/hours apart, never concurrent in practice. Mirrors the
 * style of other KV-lock usages in this repo (e.g. tenant burst locks).
 *
 * Also writes an `engine_locks` D1 row as an audit trail (last run/status) —
 * NOT the source of truth for mutual exclusion, the KV TTL key is.
 */

const LOCK_PREFIX = 'engine:lock:'

export async function acquireLock(kv: KVNamespace, job: string, ttlMs: number): Promise<boolean> {
  const key = `${LOCK_PREFIX}${job}`
  const existing = await kv.get(key)
  if (existing) return false
  await kv.put(key, String(Date.now()), { expirationTtl: Math.max(60, Math.ceil(ttlMs / 1000)) })
  return true
}

export async function releaseLock(kv: KVNamespace, job: string): Promise<void> {
  await kv.delete(`${LOCK_PREFIX}${job}`)
}

export async function recordLockRun(
  db: D1Database,
  job: string,
  status: 'success' | 'failure' | 'running',
  nowMs: number = Date.now(),
): Promise<void> {
  try {
    await db
      .prepare(
        `INSERT INTO engine_locks (job, locked_at, locked_until, last_run_at, last_status, updated_at)
         VALUES (?1, NULL, NULL, ?2, ?3, ?2)
         ON CONFLICT(job) DO UPDATE SET last_run_at = ?2, last_status = ?3, updated_at = ?2`,
      )
      .bind(job, nowMs, status)
      .run()
  } catch (err) {
    console.error(`[engine-lock] failed to record run for "${job}":`, err instanceof Error ? err.message : err)
  }
}
