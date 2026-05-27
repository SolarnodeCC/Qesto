import { describe, expect, it } from 'vitest'
import {
  defaultLiveProtocolVersion,
  isLiveProtocolSupported,
  liveProtocolFeatures,
  LIVE_PROTOCOL_VERSION_V2,
} from '../../functions/api/realtime'

describe('realtime v2', () => {
  it('defaults to v1 without env flags', () => {
    expect(defaultLiveProtocolVersion({})).toBe(1)
  })

  it('defaults to v2 when REALTIME_V2_DEFAULT=true', () => {
    expect(defaultLiveProtocolVersion({ REALTIME_V2_DEFAULT: 'true', REALTIME_V2_ENABLED: 'true' })).toBe(2)
  })

  it('supports v2 only when enabled', () => {
    expect(isLiveProtocolSupported(2, {})).toBe(false)
    expect(isLiveProtocolSupported(2, { REALTIME_V2_ENABLED: 'true' })).toBe(true)
  })

  it('exposes delta features for v2', () => {
    expect(liveProtocolFeatures(LIVE_PROTOCOL_VERSION_V2)).toContain('delta_results')
  })
})
