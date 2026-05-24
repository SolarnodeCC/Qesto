/**
 * Distributed trace propagation (Sprint 49).
 * Accepts x-trace-id and x-parent-trace-id; parent is echoed on responses.
 */

const TRACE_RE = /^[a-zA-Z0-9_-]{8,128}$/

export type TraceHeaders = {
  trace_id: string
  parent_trace_id: string | null
}

export function parseTraceHeaders(getHeader: (name: string) => string | undefined): TraceHeaders {
  const incoming = getHeader('x-trace-id')
  const trace_id = incoming && TRACE_RE.test(incoming) ? incoming : crypto.randomUUID()
  const parentRaw = getHeader('x-parent-trace-id')
  const parent_trace_id = parentRaw && TRACE_RE.test(parentRaw) ? parentRaw : null
  return { trace_id, parent_trace_id }
}

/** Append parent trace to AE detail blob when present. */
export function traceDetail(base: string | undefined, parent_trace_id: string | null): string | undefined {
  if (!parent_trace_id) return base
  const parent = `parent:${parent_trace_id}`
  return base ? `${base}|${parent}` : parent
}
