// User, plan tiers, and per-tier quota shape.

export type User = {
  id: string
  email: string
  display_name: string | null
  plan: 'free' | 'starter' | 'team'
}

export type PlanTier = User['plan']

export interface PlanQuotas {
  maxSessionsPerMonth: number
  maxParticipantsPerSession: number
  featuresUnlocked: {
    resultsExport: boolean
    semanticSearch: boolean
    insightsAI: boolean
    customBranding: boolean
    consentMode: boolean
    rankingQuestions: boolean
    samlSso: boolean
    /** TOWNHALL (ADR-0044): moderated anonymous Q&A sessions — Team tier only. */
    townhallQA: boolean
    /** COPILOT (ADR-0046): live facilitator copilot — paid tiers (starter + team). */
    liveCopilot: boolean
    /** INSIGHTS+ (ADR-0045): cross-session intelligence — Team tier only (Sprint 81+). */
    crossSessionInsights: boolean
    /** ADR-0048: recurring workspaces (RETRO / IDEATE / EVENT) — Team tier only. */
    recurringWorkspaces: boolean
    /** ADR-0049: DELIBERATE verifiable governance voting — Team tier only. */
    verifiableVoting: boolean
    /** ADR-0050: EMBED — mint origin-bound widget tokens + embed live widget — Team tier only. */
    embedWidgets: boolean
    /** ADR-0051: CAPTIONS — live ASR + translation caption pipeline — Team tier only. */
    liveCaptions: boolean
    /** ADR-0055: REACTIONS — ephemeral live reaction channel — Starter+ tiers. */
    liveReactions: boolean
    /** ADR-0057: PULSE — HR engagement analytics product — Team tier only. */
    pulseAnalytics: boolean
  }
}
