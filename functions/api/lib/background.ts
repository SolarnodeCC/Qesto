/**
 * Run a promise past the response without letting the runtime cancel it.
 *
 * `void somePromise()` in a Worker is cancelled once the response is sent (the
 * isolate may stop scheduling it), which silently dropped auth / GDPR audit
 * rows and multi-region write telemetry. This hands the promise to
 * `executionCtx.waitUntil` when one exists (Vitest's app.request() has none)
 * and always attaches a rejection handler so failures are logged, never
 * unhandled.
 */
import { logBestEffort } from './log'

type HasExecutionCtx = { executionCtx: { waitUntil(p: Promise<unknown>): void } }

export function background(c: HasExecutionCtx, work: Promise<unknown>, label = 'background'): void {
  const guarded = work.catch((err) => {
    // Best-effort by design: the caller already responded; log instead of throw.
    logBestEffort(err, { traceId: 'background', route: label, operation: 'waitUntil', reason: 'background_task_failed' })
  })
  try {
    c.executionCtx.waitUntil(guarded)
  } catch {
    void guarded
  }
}
