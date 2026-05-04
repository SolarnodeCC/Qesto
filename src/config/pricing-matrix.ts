import type { PlanConfig } from './plans'

export type MatrixVal = boolean | string
export type MatrixRowSource = 'quota' | 'static' | 'roadmap'
export type PricingMatrixRow = [string, MatrixVal, MatrixVal, MatrixVal, MatrixRowSource]

export type PricingMatrixSection = {
  section: string
  rows: PricingMatrixRow[]
}

/**
 * Static marketing rows; `enrichPricingMatrix` overwrites cells that map to `PLAN_QUOTAS` / plan features.
 * Pulse / Signal / Chorus columns align to free / starter / team.
 */
export const PRICING_MATRIX_BASE: PricingMatrixSection[] = [
  {
    section: 'Sessions & participants',
    rows: [
      ['New sessions per month', '—', '—', '—', 'quota'],
      ['Max participants per session', '—', '—', '—', 'quota'],
      ['Question types', '8', '8', '8 + custom', 'static'],
      ['Retention', '30 days', '365 days', '7d - 7yr', 'static'],
    ],
  },
  {
    section: 'Privacy & consent',
    rows: [
      ['Full anonymity mode', true, true, true, 'static'],
      ['Cohort-visible mode', true, true, true, 'static'],
      ['Identified mode + consent log', false, true, true, 'quota'],
      ['Minimum tally gating', '5 (fixed)', 'Configurable', 'Configurable', 'static'],
    ],
  },
  {
    section: 'AI insights',
    rows: [
      ['AI draft recaps', '5 / mo', 'Unlimited', 'Unlimited', 'static'],
      ['Evidence-anchored clusters', false, true, true, 'quota'],
      ['Private Workers AI endpoint', false, false, true, 'quota'],
    ],
  },
  {
    section: 'Admin & compliance',
    rows: [
      ['SSO (OIDC, SAML)', false, 'Google, Okta', 'All IdPs + SCIM', 'quota'],
      ['Data residency', 'Global', 'EU or US', 'Custom', 'static'],
      ['DPA & SOC 2 report', 'DPA only', true, true, 'static'],
      ['Customer-managed keys', false, false, true, 'roadmap'],
      ['Uptime SLA', '—', '99.9%', '99.95%', 'static'],
    ],
  },
  {
    section: 'Integrations',
    rows: [
      ['CSV / PDF / JSON export', true, true, true, 'quota'],
      ['Webhooks (Slack, Notion, Workday)', false, true, true, 'roadmap'],
      ['Branded domain & PDF templates', false, false, true, 'quota'],
    ],
  },
]

export function enrichPricingMatrix(
  base: PricingMatrixSection[],
  free: PlanConfig,
  starter: PlanConfig,
  team: PlanConfig,
): PricingMatrixSection[] {
  const F = free.features
  const S = starter.features
  const T = team.features

  return base.map((section) => ({
    section: section.section,
    rows: section.rows.map((row): PricingMatrixRow => {
      const title = row[0]
      const source = row[4]
      switch (title) {
        case 'New sessions per month':
          return [title, String(F.sessionsPerMonth), String(S.sessionsPerMonth), String(T.sessionsPerMonth), source]
        case 'Max participants per session':
          return [
            title,
            String(F.participantsPerSession),
            String(S.participantsPerSession),
            String(T.participantsPerSession),
            source,
          ]
        case 'Identified mode + consent log':
          return [title, F.consentMode, S.consentMode, T.consentMode, source]
        case 'Evidence-anchored clusters':
          return [title, F.semanticSearch, S.semanticSearch, T.semanticSearch, source]
        case 'Private Workers AI endpoint':
          return [title, false, false, T.insightsAI, source]
        case 'SSO (OIDC, SAML)':
          return [title, F.samlSso, S.samlSso, T.samlSso, source]
        case 'CSV / PDF / JSON export':
          return [title, F.resultsExport, S.resultsExport, T.resultsExport, source]
        case 'Branded domain & PDF templates':
          return [title, F.customBranding, S.customBranding, T.customBranding, source]
        default:
          return row
      }
    }),
  }))
}
