import { describe, expect, it } from 'vitest'
import {
  getMultiRegionConfig,
  resolveReadRegion,
  resolveWriteRegion,
  setMultiRegionFailoverActive,
  isMultiRegionFailoverActive,
  MULTI_REGION_FAILOVER_KV_KEY,
} from '../../functions/api/lib/multi-region'

describe('multi-region routing', () => {
  it('defaults to US primary when disabled', () => {
    const cfg = getMultiRegionConfig({})
    expect(cfg.primary).toBe('us')
    expect(cfg.enabled).toBe(false)
    expect(resolveReadRegion('AMS', cfg)).toBe('us')
    expect(resolveWriteRegion(cfg, false)).toBe('us')
  })

  it('routes EU colos when enabled', () => {
    const cfg = getMultiRegionConfig({ MULTI_REGION_ENABLED: 'true', MULTI_REGION_REPLICAS: 'eu' })
    expect(resolveReadRegion('AMS', cfg)).toBe('eu')
    expect(resolveReadRegion('IAD', cfg)).toBe('us')
  })

  it('promotes replica as write target on failover', () => {
    const cfg = getMultiRegionConfig({
      MULTI_REGION_ENABLED: 'true',
      MULTI_REGION_PRIMARY: 'us',
      MULTI_REGION_REPLICAS: 'eu',
    })
    expect(resolveWriteRegion(cfg, false)).toBe('us')
    expect(resolveWriteRegion(cfg, true)).toBe('eu')
  })

  it('persists failover flag in KV', async () => {
    const store = new Map<string, string>()
    const kv = {
      get: async (key: string) => store.get(key) ?? null,
      put: async (key: string, value: string) => {
        store.set(key, value)
      },
      delete: async (key: string) => {
        store.delete(key)
      },
    } as unknown as KVNamespace

    expect(await isMultiRegionFailoverActive(kv)).toBe(false)
    await setMultiRegionFailoverActive(kv, true)
    expect(await kv.get(MULTI_REGION_FAILOVER_KV_KEY)).toBe('true')
    expect(await isMultiRegionFailoverActive(kv)).toBe(true)
    await setMultiRegionFailoverActive(kv, false)
    expect(await isMultiRegionFailoverActive(kv)).toBe(false)
  })
})
