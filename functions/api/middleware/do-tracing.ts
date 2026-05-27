// SessionRoom DO span instrumentation (Phase 8 Step 1: Observability).
// Wraps DO fetch calls with trace_id propagation via cf-session-trace-id header.
// Records latency of message broadcasts, vote accepts, question advances.

import { recordSpan } from '../lib/observability'
import type { Context } from 'hono'

export async function fetchWithTracing(
  roomStub: DurableObjectStub,
  url: string,
  options: RequestInit & { traceId: string; userId?: string; operation: string },
  c: Context,
): Promise<unknown> {
  const { traceId, userId, operation, ...fetchOpts } = options

  // Propagate trace_id via custom header
  const headers = new Headers(fetchOpts.headers || {})
  headers.set('cf-session-trace-id', traceId)

  const response = await recordSpan(operation, async () => {
    return roomStub.fetch(url, { ...fetchOpts, headers })
  }, {
    trace_id: traceId,
    ...(userId ? { user_id: userId } : {}),
    kv: c.env.SESSIONS_KV,
  })

  if (!response.ok) {
    throw new Error(`DO fetch failed: ${response.status} ${response.statusText}`)
  }

  return response.json()
}
