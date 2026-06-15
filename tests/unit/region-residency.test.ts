import { describe, expect, it } from 'vitest'
import {
  SOVEREIGN_REGION_IDS,
  DEFAULT_REGION_ID,
  resolveRegion,
  regionKvKey,
  assertSameRegion,
  isSovereignRegion,
  publicRegionCatalog,
} from '../../functions/api/lib/region-residency'

describe('SOVEREIGN region residency (SOVEREIGN-00 / SOVEREIGN-REGIONS-01)', () => {
  it('exposes the three planned regions', () => {
    expect([...SOVEREIGN_REGION_IDS]).toEqual(['eu-001', 'uk-001', 'ca-001'])
  })

  it('validates region ids', () => {
    expect(isSovereignRegion('eu-001')).toBe(true)
    expect(isSovereignRegion('xx-999')).toBe(false)
    expect(isSovereignRegion(null)).toBe(false)
  })

  it('resolves unknown/empty region to the default', () => {
    expect(resolveRegion('uk-001').id).toBe('uk-001')
    expect(resolveRegion(undefined).id).toBe(DEFAULT_REGION_ID)
    expect(resolveRegion('nope').id).toBe(DEFAULT_REGION_ID)
  })

  it('namespaces KV keys by region so regions cannot collide', () => {
    const eu = regionKvKey('eu-001', 'session:abc')
    const uk = regionKvKey('uk-001', 'session:abc')
    expect(eu).not.toEqual(uk)
    expect(eu.startsWith('r:eu-001:')).toBe(true)
    expect(uk.startsWith('r:uk-001:')).toBe(true)
  })

  it('passes when tenant and data region match', () => {
    const r = assertSameRegion('ca-001', 'ca-001')
    expect(r.ok).toBe(true)
  })

  it('flags a cross-region data leak when regions differ', () => {
    const r = assertSameRegion('eu-001', 'uk-001')
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.code).toBe('cross_region_data_leak')
      expect(r.expected).toBe('eu-001')
      expect(r.actual).toBe('uk-001')
    }
  })

  it('public catalog never leaks internal kv prefixes', () => {
    const cat = publicRegionCatalog()
    expect(cat).toHaveLength(3)
    for (const r of cat) {
      expect(r).not.toHaveProperty('kvPrefix')
      expect(r.jurisdiction.length).toBeGreaterThan(0)
    }
  })
})
