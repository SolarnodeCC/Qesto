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
      ['Question types', '8', '8', '8', 'static'],
      ['Retention', '30 days', '365 days', 'Up to 7 years', 'static'],
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
      ['AI-generated recaps', false, false, true, 'quota'],
      ['Evidence-anchored clusters', false, false, true, 'quota'],
      ['Private Workers AI (no data leaves your session)', false, false, true, 'quota'],
      ['Semantic decision search (by meaning)', false, true, true, 'quota'],
    ],
  },
  {
    section: 'Live Q&A',
    rows: [
      ['Townhall Q&A board', false, false, true, 'quota'],
    ],
  },
  {
    section: 'Admin & compliance',
    rows: [
      ['SAML SSO', false, false, true, 'quota'],
      ['Residency guarantee', false, false, 'Roadmap', 'roadmap'],
      ['Security review packet', 'Request', 'Request', 'Chorus review', 'static'],
      ['Customer-managed keys', false, false, 'Roadmap', 'roadmap'],
      ['Uptime commitment', 'Community SLA', 'Community SLA', 'Order form', 'static'],
    ],
  },
  {
    section: 'Integrations',
    rows: [
      ['CSV export', true, true, true, 'quota'],
      ['Outbound webhooks (Beta)', false, false, true, 'static'],
      ['Branded domain & PDF templates', false, false, 'Roadmap', 'roadmap'],
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
        case 'AI-generated recaps':
          return [title, false, false, T.insightsAI, source]
        case 'Evidence-anchored clusters':
          return [title, false, false, T.insightsAI, source]
        case 'Private Workers AI (no data leaves your session)':
          return [title, false, false, T.insightsAI, source]
        case 'Semantic decision search (by meaning)':
          return [title, F.semanticSearch, S.semanticSearch, T.semanticSearch, source]
        case 'SAML SSO':
          return [title, F.samlSso, S.samlSso, T.samlSso, source]
        case 'CSV export':
          return [title, F.resultsExport, S.resultsExport, T.resultsExport, source]
        case 'Branded domain & PDF templates':
          return [title, false, false, 'Roadmap', source]
        case 'Townhall Q&A board':
          return [title, F.townhallQA, S.townhallQA, T.townhallQA, source]
        default:
          return row
      }
    }),
  }))
}
