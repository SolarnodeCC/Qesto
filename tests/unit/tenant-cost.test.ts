import { describe, expect, it } from 'vitest'
import { buildCostSnapshot, estimateTenantCostCents } from '../../functions/api/lib/tenant-cost'

describe('tenant-cost', () => {
  it('estimates cents from units', () => {
    expect(estimateTenantCostCents({ ai: 100, api: 1000, storageMb: 10 })).toBeGreaterThan(0)
  })

  it('builds snapshot', () => {
    const s = buildCostSnapshot('t1', { ai: 1, api: 1, storageMb: 1 })
    expect(s.teamId).toBe('t1')
    expect(s.currency).toBe('EUR')
  })
})
