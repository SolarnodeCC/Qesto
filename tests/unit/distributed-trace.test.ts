import { describe, expect, it } from 'vitest'
import { parseTraceHeaders, traceDetail } from '../../functions/api/lib/distributed-trace'

describe('distributed-trace', () => {
  it('generates trace_id when header missing', () => {
    const h = parseTraceHeaders(() => undefined)
    expect(h.trace_id.length).toBeGreaterThan(8)
    expect(h.parent_trace_id).toBeNull()
  })

  it('accepts valid parent trace', () => {
    const h = parseTraceHeaders((name) =>
      name === 'x-trace-id' ? 'child-trace-12345678' : name === 'x-parent-trace-id' ? 'parent-trace-12345678' : undefined,
    )
    expect(h.trace_id).toBe('child-trace-12345678')
    expect(h.parent_trace_id).toBe('parent-trace-12345678')
  })

  it('traceDetail appends parent', () => {
    expect(traceDetail('vote', 'p1')).toBe('vote|parent:p1')
    expect(traceDetail(undefined, 'p1')).toBe('parent:p1')
  })
})
