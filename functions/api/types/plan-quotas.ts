// Runtime plan-quota table. Lives apart from the type modules so that
// type-only imports never pull this data into a bundle.

import type { PlanTier, PlanQuotas } from './billing'

export const PLAN_QUOTAS: Record<PlanTier, PlanQuotas> = {
  free: {
    maxSessionsPerMonth: 5,
    maxParticipantsPerSession: 50,
    featuresUnlocked: {
      resultsExport: false,
      semanticSearch: false,
      insightsAI: false,
      customBranding: false,
      consentMode: false,
      rankingQuestions: false,
      samlSso: false,
      townhallQA: false,
      liveCopilot: false,
      crossSessionInsights: false,
      recurringWorkspaces: false,
      verifiableVoting: false,
      embedWidgets: false,
      liveCaptions: false,
      liveReactions: false,
      pulseAnalytics: false,
    },
  },
  starter: {
    maxSessionsPerMonth: 50,
    maxParticipantsPerSession: 500,
    featuresUnlocked: {
      resultsExport: true,
      semanticSearch: true,
      insightsAI: false,
      customBranding: true,
      consentMode: true,
      rankingQuestions: true,
      samlSso: false,
      townhallQA: false,
      liveCopilot: true,
      crossSessionInsights: false,
      recurringWorkspaces: false,
      verifiableVoting: false,
      embedWidgets: false,
      liveCaptions: false,
      liveReactions: true,
      pulseAnalytics: false,
    },
  },
  team: {
    maxSessionsPerMonth: 500, // effectively unlimited
    maxParticipantsPerSession: 5000,
    featuresUnlocked: {
      resultsExport: true,
      semanticSearch: true,
      insightsAI: true,
      customBranding: true,
      consentMode: true,
      rankingQuestions: true,
      samlSso: true,
      townhallQA: true,
      liveCopilot: true,
      crossSessionInsights: true,
      recurringWorkspaces: true,
      verifiableVoting: true,
      embedWidgets: true,
      liveCaptions: true,
      liveReactions: true,
      pulseAnalytics: true,
    },
  },
}
