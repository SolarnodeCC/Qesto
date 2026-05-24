import { describe, expect, it } from 'vitest'
import { getMultiRegionConfig, resolveReadRegion } from '../../functions/api/lib/multi-region'

describe('multi-region routing', () => {
  it('defaults to US primary when disabled', () => {
    const cfg = getMultiRegionConfig({})
    expect(cfg.primary).toBe('us')
    expect(cfg.enabled).toBe(false)
    expect(resolveReadRegion('AMS', cfg)).toBe('us')
  })

  it('routes EU colos when enabled', () => {
    const cfg = getMultiRegionConfig({ MULTI_REGION_ENABLED: 'true', MULTI_REGION_REPLICAS: 'eu' })
    expect(resolveReadRegion('AMS', cfg)).toBe('eu')
    expect(resolveReadRegion('IAD', cfg)).toBe('us')
  })
})
