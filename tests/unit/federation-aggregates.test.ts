import { describe, expect, it } from 'vitest'
import {
  buildFederatedAggregate,
  findIdentityLeak,
  aggregateIsSafe,
  type TenantContribution,
} from '../../functions/api/lib/federation-aggregates'

const contributions: TenantContribution[] = [
  { teamId: 'org-a', participantIds: ['a1', 'a2'], optionCounts: { yes: 2, no: 0 } },
  { teamId: 'org-b', participantIds: ['b1', 'b2', 'b3'], optionCounts: { yes: 1, no: 2 } },
]

describe('CONNECT-ZEROK-01 — federated aggregate', () => {
  it('combines tenant counts and option totals', () => {
    const agg = buildFederatedAggregate(contributions, { zeroKnowledge: false })
    expect(agg.tenantCount).toBe(2)
    expect(agg.totalParticipants).toBe(5)
    expect(agg.optionTotals).toEqual({ yes: 3, no: 2 })
  })

  it('de-duplicates participants shared across tenants', () => {
    const agg = buildFederatedAggregate(
      [
        { teamId: 'a', participantIds: ['shared'], optionCounts: {} },
        { teamId: 'b', participantIds: ['shared'], optionCounts: {} },
      ],
      { zeroKnowledge: false },
    )
    expect(agg.totalParticipants).toBe(1)
  })

  it('omits per-tenant attribution under zero-knowledge', () => {
    const zk = buildFederatedAggregate(contributions, { zeroKnowledge: true })
    expect(zk.perTenant).toBeUndefined()
    const open = buildFederatedAggregate(contributions, { zeroKnowledge: false })
    expect(open.perTenant).toEqual([
      { teamId: 'org-a', participants: 2 },
      { teamId: 'org-b', participants: 3 },
    ])
  })

  it('never carries participant ids — even in open mode per-tenant counts', () => {
    const open = buildFederatedAggregate(contributions, { zeroKnowledge: false })
    expect(JSON.stringify(open)).not.toContain('a1')
    expect(JSON.stringify(open)).not.toContain('b3')
  })
})

describe('CONNECT-ZEROK-01 — identity-leak guard', () => {
  it('reports no leak for a correctly built aggregate', () => {
    const agg = buildFederatedAggregate(contributions, { zeroKnowledge: false })
    expect(findIdentityLeak(agg, contributions)).toEqual([])
    expect(aggregateIsSafe(agg, contributions)).toBe(true)
  })

  it('catches a participant id that leaked into the aggregate', () => {
    const agg = buildFederatedAggregate(contributions, { zeroKnowledge: false })
    // Simulate a regression that surfaced a raw id in an option key.
    ;(agg.optionTotals as Record<string, number>)['a1'] = 1
    expect(findIdentityLeak(agg, contributions)).toEqual(['a1'])
    expect(aggregateIsSafe(agg, contributions)).toBe(false)
  })

  it('is vacuously safe when there are no participants', () => {
    const agg = buildFederatedAggregate([], { zeroKnowledge: true })
    expect(aggregateIsSafe(agg, [])).toBe(true)
  })
})
