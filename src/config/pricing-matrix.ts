import type { PlanConfig } from './plans'

export type MatrixVal = boolean | string

export type PricingMatrixSection = {
  section: string
  rows: [string, MatrixVal, MatrixVal, MatrixVal][]
}

/**
 * Static marketing rows; `enrichPricingMatrix` overwrites cells that map to `PLAN_QUOTAS` / plan features.
 * Pulse / Signal / Chorus columns align to free / starter / team.
 */
export const PRICING_MATRIX_BASE: PricingMatrixSection[] = [
  {
    section: 'Sessions & participants',
    rows: [
      ['New sessions per month', '—', '—', '—'],
      ['Max participants per session', '—', '—', '—'],
      ['Question types', '8', '8', '8 + custom'],
      ['Retention', '30 days', '365 days', '7d – 7yr'],
    ],
  },
  {
    section: 'Privacy & consent',
    rows: [
      ['Full anonymity mode', true, true, true],
      ['Cohort-visible mode', true, true, true],
      ['Identified mode + consent log', false, true, true],
      ['Minimum tally gating', '5 (fixed)', 'Configurable', 'Configurable'],
    ],
  },
  {
    section: 'AI insights',
    rows: [
      ['AI draft recaps', '5 / mo', 'Unlimited', 'Unlimited'],
      ['Evidence-anchored clusters', false, true, true],
      ['Private Workers AI endpoint', false, false, true],
    ],
  },
  {
    section: 'Admin & compliance',
    rows: [
      ['SSO (OIDC, SAML)', false, 'Google, Okta', 'All IdPs + SCIM'],
      ['Data residency', 'Global', 'EU or US', 'Custom'],
      ['DPA & SOC 2 report', 'DPA only', true, true],
      ['Customer-managed keys', false, false, true],
      ['Uptime SLA', '—', '99.9%', '99.95%'],
    ],
  },
  {
    section: 'Integrations',
    rows: [
      ['CSV / PDF / JSON export', true, true, true],
      ['Webhooks (Slack, Notion, Workday)', false, true, true],
      ['Branded domain & PDF templates', false, false, true],
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
    rows: section.rows.map((row): [string, MatrixVal, MatrixVal, MatrixVal] => {
      const title = row[0]
      switch (title) {
        case 'New sessions per month':
          return [title, String(F.sessionsPerMonth), String(S.sessionsPerMonth), String(T.sessionsPerMonth)]
        case 'Max participants per session':
          return [title, String(F.participantsPerSession), String(S.participantsPerSession), String(T.participantsPerSession)]
        case 'Identified mode + consent log':
          return [title, F.consentMode, S.consentMode, T.consentMode]
        case 'Evidence-anchored clusters':
          return [title, F.semanticSearch, S.semanticSearch, T.semanticSearch]
        case 'Private Workers AI endpoint':
          return [title, false, false, T.insightsAI]
        case 'SSO (OIDC, SAML)':
          return [title, F.samlSso, S.samlSso, T.samlSso]
        case 'CSV / PDF / JSON export':
          return [title, F.resultsExport, S.resultsExport, T.resultsExport]
        case 'Branded domain & PDF templates':
          return [title, F.customBranding, S.customBranding, T.customBranding]
        default:
          return row
      }
    }),
  }))
}
