export type CompareCell = 'yes' | 'no' | 'partial' | string

export type CompetitorComparePageData = {
  slug: string
  competitorName: string
  title: string
  description: string
  h1: string
  tldr: string
  whoQestoSuits: string[]
  whoCompetitorSuits: string[]
  migrationSteps: string[]
  rows: Array<{ feature: string; qesto: CompareCell; competitor: CompareCell; note?: string }>
  relatedLinks: Array<{ href: string; label: string }>
  /** Source note shown on-page — keeps claims auditable. */
  sourcesNote: string
}

/** Claims drawn from knowledge-base/product/research/COMPETITOR_PROFILES.md (June 2026). */
export const MENTIMETER_COMPARE: CompetitorComparePageData = {
  slug: 'mentimeter',
  competitorName: 'Mentimeter',
  title: 'Qesto vs Mentimeter — Privacy-First Live Polling Alternative',
  description:
    'Compare Qesto and Mentimeter on privacy, edge latency, per-session pricing, and native AI insights. See who each tool suits best.',
  h1: 'Qesto vs Mentimeter',
  tldr:
    'Mentimeter is the well-known live presentation poller with strong slide integrations. Qesto is the privacy-first, edge-native alternative — anonymity modes by default, Workers AI inside your trust boundary, and per-host session plans instead of seat sprawl.',
  whoQestoSuits: [
    'Facilitators who need anonymous or cohort-visible feedback by default',
    'Teams that want AI theme clustering without sending transcripts to a third-party LLM',
    'Buyers who prefer transparent per-host session limits over per-seat enterprise quotes',
    'Workshops, training, and meetings where GDPR-ready posture is a hard requirement',
  ],
  whoCompetitorSuits: [
    'Presenters who live inside PowerPoint or Google Slides day-to-day',
    'Organizations standardized on Mentimeter’s brand and training materials',
    'Buyers who want the most familiar category leader and accept cloud-hosted data',
  ],
  migrationSteps: [
    'Pick a Pulse free room and recreate one Mentimeter deck as a Qesto session (polls, rankings, open questions).',
    'Run a consent round so participants choose identified, cohort, or anonymous before sensitive questions open.',
    'Export the recap and compare response rates against your last Mentimeter session.',
    'Upgrade to Signal when you need longer retention, consent logs, or recurring weekly rooms.',
  ],
  rows: [
    { feature: 'Live polls & rankings', qesto: 'yes', competitor: 'yes' },
    { feature: 'Slide add-ins (PowerPoint / Google Slides)', qesto: 'no', competitor: 'yes', note: 'Mentimeter leads on slide lock-in; Qesto is browser-first.' },
    { feature: 'Anonymity modes (full / cohort / identified)', qesto: 'yes', competitor: 'partial', note: 'Qesto starts every session with an explicit consent round.' },
    { feature: 'Edge-native delivery (Cloudflare Workers)', qesto: 'yes', competitor: 'no' },
    { feature: 'AI insights without third-party model egress', qesto: 'yes', competitor: 'partial', note: 'Qesto runs Workers AI inside the session trust boundary.' },
    { feature: 'Per-host / session pricing (not per seat)', qesto: 'yes', competitor: 'no', note: 'Mentimeter Pro is commonly sold per month with participant caps; Qesto publishes host-tier limits.' },
    { feature: 'SSO & enterprise audit exports', qesto: 'partial', competitor: 'yes', note: 'Qesto Chorus includes SAML SSO; Mentimeter’s enterprise suite is more mature.' },
    { feature: 'Free tier to start', qesto: 'yes', competitor: 'yes' },
  ],
  relatedLinks: [
    { href: '/features/privacy', label: 'Privacy by default' },
    { href: '/features/ai-insights', label: 'AI insights' },
    { href: '/pricing', label: 'Pricing' },
    { href: '/compare', label: 'All comparisons' },
  ],
  sourcesNote:
    'Differentiation claims reference Qesto’s published product posture and Mentimeter strengths/weaknesses documented in knowledge-base/product/research/COMPETITOR_PROFILES.md. Mentimeter is a trademark of its owner; comparison is independent.',
}

/** Claims from COMPETITOR_PROFILES.md + MARKET_VALIDATION_S81_90.md (town-hall angle). */
export const SLIDO_COMPARE: CompetitorComparePageData = {
  slug: 'slido',
  competitorName: 'Slido',
  title: 'Qesto vs Slido — Anonymous Live Q&A Without Cisco Lock-in',
  description:
    'Compare Qesto and Slido for town halls and events: anonymity at scale, edge latency, and no Cisco ecosystem lock-in.',
  h1: 'Qesto vs Slido',
  tldr:
    'Slido is the enterprise engagement platform often shipped with Cisco Webex for large Q&A and events. Qesto targets the same job — honest room feedback — with explicit anonymity modes, edge latency, and no requirement to join a collaboration suite.',
  whoQestoSuits: [
    'Internal-comms and HR hosts who need clear anonymity posture for psychological safety',
    'Teams that want live polls plus AI themes without Cisco stack lock-in',
    'Facilitators who prefer a focused tool over a broad enterprise feature matrix',
    'Events that need sub-second edge updates for hybrid rooms',
  ],
  whoCompetitorSuits: [
    'Organizations already standardized on Cisco Webex and Slido moderation workflows',
    'Very large conferences that need Slido’s mature Q&A moderation depth today',
    'Buyers who want Salesforce/Adobe/Cisco integration breadth in one vendor',
  ],
  migrationSteps: [
    'Map your next town hall agenda into a Qesto session (live Q&A board on Chorus, polls on any tier).',
    'Set anonymity mode before the first sensitive question and share the join code or QR.',
    'Moderate open questions live; export the consent log and recap afterward.',
    'Keep Slido for Webex-native meetings if needed; use Qesto where privacy clarity matters most.',
  ],
  rows: [
    { feature: 'Live Q&A / upvoting', qesto: 'yes', competitor: 'yes', note: 'Townhall Q&A board is available on Chorus (beta).' },
    { feature: 'Cisco / Webex ecosystem lock-in', qesto: 'no', competitor: 'yes' },
    { feature: 'Explicit anonymity + consent log', qesto: 'yes', competitor: 'partial' },
    { feature: 'Edge-native global latency', qesto: 'yes', competitor: 'no' },
    { feature: 'AI themes from open responses (no third-party LLM egress)', qesto: 'yes', competitor: 'partial' },
    { feature: 'Transparent self-serve pricing', qesto: 'yes', competitor: 'partial', note: 'Slido enterprise pricing is often opaque quote-based.' },
    { feature: 'Deep Salesforce / Adobe integrations', qesto: 'no', competitor: 'yes' },
    { feature: 'Focused facilitator UX', qesto: 'yes', competitor: 'partial' },
  ],
  relatedLinks: [
    { href: '/events', label: 'Qesto for events' },
    { href: '/hr', label: 'Qesto for HR' },
    { href: '/features/privacy', label: 'Privacy by default' },
    { href: '/compare', label: 'All comparisons' },
  ],
  sourcesNote:
    'Based on Slido strengths/weaknesses in knowledge-base/product/research/COMPETITOR_PROFILES.md and the town-hall priority notes in MARKET_VALIDATION_S81_90.md. Slido is a trademark of its owner.',
}

/**
 * Parabol has no full battle card yet — keep claims high-level from
 * MARKET_VALIDATION_S81_90.md only (anonymous retros + AI clustering moat).
 */
export const PARABOL_COMPARE: CompetitorComparePageData = {
  slug: 'parabol',
  competitorName: 'Parabol',
  title: 'Qesto vs Parabol — Anonymous Retros with AI Theme Clustering',
  description:
    'Compare Qesto and Parabol for agile retros: anonymity, AI theme clustering, and action-ready exports — without fabricated feature claims.',
  h1: 'Qesto vs Parabol',
  tldr:
    'Parabol is a strong-brand retrospective tool for agile teams. Qesto approaches the same job with session anonymity modes and native Workers AI theme clustering so honest retros stay private and leave with evidence — not just stickies.',
  whoQestoSuits: [
    'Teams that will not run an honest retro without strong anonymity guarantees',
    'Facilitators who want AI affinity clustering inside the same privacy boundary as the room',
    'Groups that already use Qesto for workshops and want retros in the same product',
  ],
  whoCompetitorSuits: [
    'Agile teams already standardized on Parabol’s retro rituals and integrations',
    'Organizations that want a dedicated retro product rather than a multi-format session tool',
  ],
  migrationSteps: [
    'Create a Qesto session from a retrospective template (or blank) with anonymity enabled.',
    'Collect open reflections; run AI theme clustering on the responses.',
    'Export themes and verbatim evidence into your action tracker.',
    'Keep Parabol where its workflow is already embedded; use Qesto when anonymity is the gate.',
  ],
  rows: [
    { feature: 'Retrospective / reflection sessions', qesto: 'yes', competitor: 'yes' },
    { feature: 'Anonymity as a first-class session mode', qesto: 'yes', competitor: 'partial', note: 'Qesto’s documented moat for retros is anonymity + native AI clustering.' },
    { feature: 'Native AI theme clustering (Workers AI)', qesto: 'yes', competitor: 'partial' },
    { feature: 'Multi-format sessions (polls, rankings, consent, open Q)', qesto: 'yes', competitor: 'partial' },
    { feature: 'Dedicated agile ritual product depth', qesto: 'partial', competitor: 'yes', note: 'Parabol specializes in agile workflows; Qesto is facilitator-general.' },
    { feature: 'Edge-native realtime', qesto: 'yes', competitor: 'partial' },
  ],
  relatedLinks: [
    { href: '/use-cases/team-meetings', label: 'Team meetings use case' },
    { href: '/features/ai-insights', label: 'AI insights' },
    { href: '/features/privacy', label: 'Privacy by default' },
    { href: '/compare', label: 'All comparisons' },
  ],
  sourcesNote:
    'High-level positioning only — Parabol lacks a full battle card in knowledge-base/product/research/COMPETITOR_PROFILES.md. Angles follow knowledge-base/product/research/MARKET_VALIDATION_S81_90.md (anonymous retros + native AI clustering). Parabol is a trademark of its owner.',
}

export const COMPETITOR_PAGES: Record<string, CompetitorComparePageData> = {
  mentimeter: MENTIMETER_COMPARE,
  slido: SLIDO_COMPARE,
  parabol: PARABOL_COMPARE,
}

export const COMPARE_HUB_LINKS = [
  {
    slug: 'mentimeter',
    name: 'Mentimeter',
    blurb: 'Privacy-first live polling vs the category leader — per-session pricing and edge AI.',
  },
  {
    slug: 'slido',
    name: 'Slido',
    blurb: 'Anonymous town-hall engagement without Cisco ecosystem lock-in.',
  },
  {
    slug: 'parabol',
    name: 'Parabol',
    blurb: 'Honest retros with anonymity and native AI theme clustering.',
  },
]
