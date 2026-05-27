import { describe, expect, it } from 'vitest'
import { computeSloBudgets, PLATFORM_SLOS } from '../../functions/api/lib/slo'

describe('SLO budgets', () => {
  it('defines platform SLOs', () => {
    expect(PLATFORM_SLOS.length).toBeGreaterThanOrEqual(3)
  })

  it('marks healthy when observed meets target', () => {
    const budgets = computeSloBudgets({
      api_availability: { ok: 999, total: 1000 },
    })
    const api = budgets.find((b) => b.sloId === 'api_availability')
    expect(api?.status).toBe('healthy')
  })
})
