import { describe, expect, it } from 'vitest'
import {
  proveRegionIsolation,
  filterToRegion,
  regionScopedSqlFragment,
  ISOLATION_LEAK_SAMPLE_LIMIT,
  type RegionScopedRow,
} from '../../functions/api/lib/region-isolation'

const rows = (specs: Array<[string, string | null, string?]>): RegionScopedRow[] =>
  specs.map(([id, regionId, teamId]) => ({ id, regionId, teamId: teamId ?? null }))

describe('SEC-SOVEREIGN-ISOLATION-01 — region isolation proof', () => {
  it('passes when every row is in-region', () => {
    const proof = proveRegionIsolation(
      rows([['a', 'eu-001'], ['b', 'eu-001']]),
      { region: 'eu-001' },
    )
    expect(proof.pass).toBe(true)
    expect(proof.total).toBe(2)
    expect(proof.inRegionCount).toBe(2)
    expect(proof.leakedCount).toBe(0)
    expect(proof.leakedSample).toEqual([])
  })

  it('detects a cross-region leak and reports it without PII', () => {
    const proof = proveRegionIsolation(
      rows([['a', 'eu-001'], ['leaky', 'uk-001'], ['c', 'eu-001']]),
      { region: 'eu-001' },
    )
    expect(proof.pass).toBe(false)
    expect(proof.leakedCount).toBe(1)
    expect(proof.inRegionCount).toBe(2)
    expect(proof.leakedSample).toHaveLength(1)
    expect(proof.leakedSample[0]).toMatchObject({
      id: 'leaky',
      expectedRegion: 'eu-001',
      actualRegion: 'uk-001',
    })
  })

  it('treats missing/unknown region as the default region (eu-001)', () => {
    const proof = proveRegionIsolation(rows([['a', null], ['b', 'bogus']]), { region: 'eu-001' })
    // default region is eu-001, so both resolve to eu-001 → no leak
    expect(proof.pass).toBe(true)
    expect(proof.leakedCount).toBe(0)
  })

  it('detects a cross-tenant leak when a tenant facet is requested', () => {
    const proof = proveRegionIsolation(
      rows([['a', 'eu-001', 'team-1'], ['x', 'eu-001', 'team-2']]),
      { region: 'eu-001', teamId: 'team-1' },
    )
    expect(proof.pass).toBe(false)
    expect(proof.crossTenantCount).toBe(1)
    expect(proof.leakedCount).toBe(0) // region was fine; tenant was not
  })

  it('counts a row that crosses both boundaries in both tallies', () => {
    const proof = proveRegionIsolation(
      rows([['both', 'uk-001', 'team-2']]),
      { region: 'eu-001', teamId: 'team-1' },
    )
    expect(proof.leakedCount).toBe(1)
    expect(proof.crossTenantCount).toBe(1)
    expect(proof.inRegionCount).toBe(0)
    expect(proof.pass).toBe(false)
  })

  it('bounds the leaked sample but counts every leak', () => {
    const many = Array.from({ length: ISOLATION_LEAK_SAMPLE_LIMIT + 10 }, (_, i): [string, string] => [
      `r${i}`,
      'uk-001',
    ])
    const proof = proveRegionIsolation(rows(many), { region: 'eu-001' })
    expect(proof.leakedCount).toBe(ISOLATION_LEAK_SAMPLE_LIMIT + 10)
    expect(proof.leakedSample).toHaveLength(ISOLATION_LEAK_SAMPLE_LIMIT)
  })

  it('handles an empty result set as a (vacuous) pass', () => {
    const proof = proveRegionIsolation([], { region: 'eu-001' })
    expect(proof.pass).toBe(true)
    expect(proof.total).toBe(0)
  })
})

describe('SEC-SOVEREIGN-ISOLATION-01 — fail-safe filter', () => {
  it('drops out-of-region and out-of-tenant rows', () => {
    const out = filterToRegion(
      rows([['a', 'eu-001', 't1'], ['b', 'uk-001', 't1'], ['c', 'eu-001', 't2']]),
      { region: 'eu-001', teamId: 't1' },
    )
    expect(out.map((r) => r.id)).toEqual(['a'])
  })

  it('keeps all in-region rows when no tenant facet given', () => {
    const out = filterToRegion(rows([['a', 'eu-001'], ['b', 'eu-001']]), { region: 'eu-001' })
    expect(out).toHaveLength(2)
  })
})

describe('SEC-SOVEREIGN-ISOLATION-01 — SQL fragment', () => {
  it('scopes by region only by default', () => {
    expect(regionScopedSqlFragment()).toBe('region_id = ?')
  })
  it('scopes by region and tenant when requested', () => {
    expect(regionScopedSqlFragment({ withTenant: true })).toBe('region_id = ? AND team_id = ?')
  })
})
