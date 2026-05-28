import { describe, expect, it } from 'vitest'
import { isLiveProtocolSupported, liveProtocolFeatures, LIVE_PROTOCOL_VERSION_V3 } from '../../functions/api/realtime'
import { parseResultsDelta } from '../../src/lib/live-session-protocol'

describe('realtime v3', () => {
  it('supports v3 when enabled', () => {
    expect(isLiveProtocolSupported(3, { REALTIME_V3_ENABLED: 'true' })).toBe(true)
    expect(LIVE_PROTOCOL_VERSION_V3).toBe(3)
  })

  it('parses results delta', () => {
    const d = parseResultsDelta({ questionId: 'q1', delta: { a: 1 } })
    expect(d?.questionId).toBe('q1')
  })

  it('lists v3 features', () => {
    expect(liveProtocolFeatures(3)).toContain('results_delta')
  })
})
