import { describe, expect, it } from 'vitest'
import {
  assertFederationAllowed,
  assertEgressAllowed,
  filterFederationEligible,
  FEDERATION_ELIGIBLE_SQL_FRAGMENT,
} from '../../functions/api/lib/sovereign-exclusion'

describe('SOVEREIGN-EXCLUSION-01 — federation guard', () => {
  it('denies federation for sovereign tenants', () => {
    const r = assertFederationAllowed({ teamId: 't1', isSovereign: true })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('sovereign_federation_excluded')
  })

  it('allows federation for non-sovereign tenants', () => {
    expect(assertFederationAllowed({ teamId: 't2', isSovereign: false }).ok).toBe(true)
  })
})

describe('SOVEREIGN-EXCLUSION-01 — egress guard', () => {
  it('denies egress for sovereign tenants', () => {
    const r = assertEgressAllowed({ teamId: 't1', isSovereign: true })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('sovereign_egress_excluded')
  })

  it('denies egress on explicit opt-out even when not sovereign', () => {
    expect(assertEgressAllowed({ teamId: 't3', isSovereign: false, egressOptOut: true }).ok).toBe(false)
  })

  it('allows egress for a standard tenant', () => {
    expect(assertEgressAllowed({ teamId: 't4', isSovereign: false }).ok).toBe(true)
  })
})

describe('SOVEREIGN-EXCLUSION-01 — query/filter helpers', () => {
  it('SQL fragment excludes sovereign rows', () => {
    expect(FEDERATION_ELIGIBLE_SQL_FRAGMENT).toContain('is_sovereign')
    expect(FEDERATION_ELIGIBLE_SQL_FRAGMENT).toContain('= 0')
  })

  it('filterFederationEligible drops sovereign tenants', () => {
    const out = filterFederationEligible([
      { teamId: 'a', isSovereign: false },
      { teamId: 'b', isSovereign: true },
      { teamId: 'c', isSovereign: false },
    ])
    expect(out.map((t) => t.teamId)).toEqual(['a', 'c'])
  })
})
