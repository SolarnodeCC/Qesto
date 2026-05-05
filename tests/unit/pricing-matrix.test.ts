import { describe, expect, it } from 'vitest'
import { enrichPricingMatrix, PRICING_MATRIX_BASE } from '../../src/config/pricing-matrix'
import { buildPlansFromCatalog, PLANS } from '../../src/config/plans'

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
    const row = adminSection?.rows.find((r) => r[0] === 'SAML SSO')
    expect(row?.[1]).toBe(false)
    expect(row?.[2]).toBe(false)
    expect(row?.[3]).toBe(true)
  })

  it('tags roadmap and static rows separately from quota-backed rows', () => {
    const [free, starter, team] = PLANS
    const m = enrichPricingMatrix(PRICING_MATRIX_BASE, free, starter, team)
    const sessions = m[0]?.rows.find((r) => r[0] === 'New sessions per month')
    const retention = m[0]?.rows.find((r) => r[0] === 'Retention')
    const integrations = m.find((s) => s.section === 'Integrations')
    const webhooks = integrations?.rows.find((r) => r[0] === 'Webhooks (Slack, Notion, Workday)')
    expect(sessions?.[4]).toBe('quota')
    expect(retention?.[4]).toBe('static')
    expect(webhooks?.[4]).toBe('roadmap')
  })

  it('derives legacy display price from catalog pricing metadata', () => {
    const plans = buildPlansFromCatalog(
      {
        free: {
          max_sessions_per_month: 5,
          max_participants_per_session: 50,
          features_unlocked: PLANS[0].features,
        },
        starter: {
          max_sessions_per_month: 50,
          max_participants_per_session: 500,
          features_unlocked: PLANS[1].features,
        },
        team: {
          max_sessions_per_month: 500,
          max_participants_per_session: 5000,
          features_unlocked: PLANS[2].features,
        },
      },
      {
        free: PLANS[0].pricing,
        starter: {
          ...PLANS[1].pricing,
          monthly_cents: 3100,
          annual_cents: 2600,
        },
        team: PLANS[2].pricing,
      },
    )
    expect(plans[1].price).toBe(31)
    expect(plans[1].pricing.annual_cents).toBe(2600)
  })
})
