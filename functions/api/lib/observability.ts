// Span tracing helper — wraps async operations (DO calls, D1 queries, KV ops)
// with latency + error bookkeeping and trace_id propagation.
//
// Design principles:
//   1. Fail open — a metrics failure never breaks the wrapped operation.
//   2. Zero PII — span names are compile-time strings, trace_id/user_id are
//      opaque identifiers. Do NOT embed emails, raw IPs or JWT tokens.
//   3. Cheap — latency is measured with `Date.now()` (millisecond granular
//      is sufficient; the workerd runtime clamps sub-ms anyway).
//
// Consumers:
//   • `loggerMiddleware` emits one span per HTTP request.
//   • `do-tracing.ts` wraps DO `fetch` calls.
//   • Route handlers can call `recordSpan('d1.sessions.select', () => ...)`.

import { recordMetric } from './metrics-kv'

export type SpanContext = {
  trace_id: string
  user_id?: string
  kv?: KVNamespace
}

export type SpanResult<T> = {
  ok: true
  value: T
  latency_ms: number
} | {
  ok: false
  error: Error
  latency_ms: number
}

/**
 * Run `operation`, record latency + error metrics to the given KV, and re-throw
 * any error so the caller still sees it. The metric write is best-effort and
 * never blocks failure propagation.
 */
export async function recordSpan<T>(
  name: string,
  operation: () => Promise<T>,
  ctx: SpanContext,
): Promise<T> {
  const start = Date.now()
  try {
    const value = await operation()
    const latency_ms = Date.now() - start
    // Fire-and-forget metric; failures are swallowed (metrics are ancillary).
    safeRecord(ctx.kv, name, latency_ms, 200, ctx.user_id, ctx.trace_id)
    return value
  } catch (err) {
    const latency_ms = Date.now() - start
    safeRecord(ctx.kv, name, latency_ms, 500, ctx.user_id, ctx.trace_id)
    throw err
  }
}

/**
 * Non-throwing variant — useful when the caller wants to branch on the result
 * without try/catch (e.g. DO fetch with a user-facing fallback).
 */
export async function recordSpanSafe<T>(
  name: string,
  operation: () => Promise<T>,
  ctx: SpanContext,
): Promise<SpanResult<T>> {
  const start = Date.now()
  try {
    const value = await operation()
    const latency_ms = Date.now() - start
    safeRecord(ctx.kv, name, latency_ms, 200, ctx.user_id, ctx.trace_id)
    return { ok: true, value, latency_ms }
  } catch (err) {
    const latency_ms = Date.now() - start
    safeRecord(ctx.kv, name, latency_ms, 500, ctx.user_id, ctx.trace_id)
    return {
      ok: false,
      error: err instanceof Error ? err : new Error(String(err)),
      latency_ms,
    }
  }
}

function safeRecord(
  kv: KVNamespace | undefined,
  route: string,
  latency_ms: number,
  status: number,
  user_id: string | undefined,
  trace_id: string,
): void {
  if (!kv) return
  // Intentionally not awaited — metric writes never block the hot path.
  void recordMetric(kv, route, latency_ms, status, user_id, trace_id).catch(() => {
    // Swallow: metrics are best-effort, and we never log PII.
  })
}
