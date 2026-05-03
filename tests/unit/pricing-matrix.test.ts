import { describe, expect, it } from 'vitest'
import { enrichPricingMatrix, PRICING_MATRIX_BASE } from '../../src/config/pricing-matrix'
import { PLANS } from '../../src/config/plans'

describe('enrichPricingMatrix', () => {
  it('injects PLAN_QUOTAS-backed session + participant counts', () => {
    const [free, starter, team] = PLANS
    const m = enrichPricingMatrix(PRICING_MATRIX_BASE, free, starter, team)
    const sessions = m[0]?.rows.find((r) => r[0] === 'New sessions per month')
    const participants = m[0]?.rows.find((r) => r[0] === 'Max participants per session')
    expect(sessions?.[1]).toBe(String(free.features.sessionsPerMonth))
    expect(sessions?.[2]).toBe(String(starter.features.sessionsPerMonth))
    expect(sessions?.[3]).toBe(String(team.features.sessionsPerMonth))
    expect(participants?.[1]).toBe(String(free.features.participantsPerSession))
    expect(participants?.[3]).toBe(String(team.features.participantsPerSession))
  })

  it('aligns SSO column with PLAN_QUOTAS SAML flags', () => {
    const [free, starter, team] = PLANS
    const m = enrichPricingMatrix(PRICING_MATRIX_BASE, free, starter, team)
    const adminSection = m.find((s) => s.section === 'Admin & compliance')
    const row = adminSection?.rows.find((r) => r[0] === 'SSO (OIDC, SAML)')
    expect(row?.[1]).toBe(false)
    expect(row?.[2]).toBe(false)
    expect(row?.[3]).toBe(true)
  })
})
