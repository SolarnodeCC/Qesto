import { describe, expect, it } from 'vitest'
import { getFlag } from '../../functions/api/lib/flags'
import { featureAllowed, denyFeature } from '../../functions/api/lib/entitlements'
import type { PlanTier, PlanQuotas } from '../../functions/api/types'

/**
 * Phase 3: Feature Gates Integration — Route access control
 *
 * Tests verify:
 * - Plan-based feature gating (free vs paid tiers)
 * - Feature denial responses and error messages
 * - Feature flag vs plan quota distinction
 * - Middleware pattern for requireFeature
 */

// Helper function to get quotas for a plan
function getQuotasForPlan(plan: PlanTier): PlanQuotas {
  const baseQuotas: Record<PlanTier, PlanQuotas> = {
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
      maxSessionsPerMonth: 100,
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
      maxSessionsPerMonth: 1000,
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
  return baseQuotas[plan]
}

describe('Feature-gated routes (Phase 3)', () => {
  describe('featureAllowed by plan', () => {
    const quotasFree: PlanQuotas = {
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
    }

    const quotasTeam: PlanQuotas = {
      maxSessionsPerMonth: 1000,
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
    }

    it('free plan blocks premium features', () => {
      expect(featureAllowed(quotasFree, 'resultsExport')).toBe(false)
      expect(featureAllowed(quotasFree, 'insightsAI')).toBe(false)
      expect(featureAllowed(quotasFree, 'townhallQA')).toBe(false)
    })

    it('team plan allows premium features', () => {
      expect(featureAllowed(quotasTeam, 'resultsExport')).toBe(true)
      expect(featureAllowed(quotasTeam, 'insightsAI')).toBe(true)
      expect(featureAllowed(quotasTeam, 'townhallQA')).toBe(true)
    })

    it('blocking free features still allows on team plan', () => {
      expect(featureAllowed(quotasFree, 'resultsExport')).toBe(false)
      expect(featureAllowed(quotasTeam, 'resultsExport')).toBe(true)
    })
  })

  describe('denyFeature error responses', () => {
    it('returns denial error for free plan', () => {
      const error = denyFeature('free', 'resultsExport')
      expect(error).toBeDefined()
      expect(error.code).toMatch(/upgrade|plan|feature/)
      expect(error.message).toBeTruthy()
    })

    it('returns denial error for team plan attempting feature-limited action', () => {
      // Team plan may still have some limits (e.g., SAML is Starter+, some features are Team-only)
      const error = denyFeature('starter', 'townhallQA')
      expect(error).toBeDefined()
      expect(error.code).toMatch(/upgrade|plan|feature/)
    })

    it('denial error includes upgrade guidance', () => {
      const error = denyFeature('free', 'insightsAI')
      expect(error.message.toLowerCase()).toMatch(/upgrade|plan|starter|team/)
    })
  })

  describe('Feature flag vs plan quota distinction', () => {
    it('boolean flags are runtime toggles independent of plan', () => {
      const env = { SENTIMENT_ENABLED: 'false' }
      // Even if user's plan allows sentiment (has quota), flag being off disables it
      const flagOff = !getFlag(env, 'SENTIMENT_ENABLED')
      expect(flagOff).toBe(true)
    })

    it('plan quotas gate access to premium endpoints', () => {
      const quotasFree: PlanQuotas = {
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
      }

      expect(featureAllowed(quotasFree, 'resultsExport')).toBe(false)
    })

    it('flags control feature behavior, quotas control access', () => {
      // Example: SENTIMENT_ENABLED flag controls whether sentiment analysis runs at all.
      // resultsExport quota controls whether /api/export endpoint is accessible.
      // They are orthogonal concerns.
      const env = { SENTIMENT_ENABLED: 'true' }
      const flagOn = getFlag(env, 'SENTIMENT_ENABLED')
      expect(flagOn).toBe(true)

      const quotas: PlanQuotas = {
        maxSessionsPerMonth: 1000,
        maxParticipantsPerSession: 5000,
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
      }

      // Flag is on but quota blocks access
      expect(getFlag(env, 'SENTIMENT_ENABLED')).toBe(true)
      expect(featureAllowed(quotas, 'resultsExport')).toBe(false)
    })
  })

  describe('Tiered access control', () => {
    const plans: PlanTier[] = ['free', 'starter', 'team']

    it('verifies monotonic feature unlocking across tiers', () => {
      // Each tier should have all features of lower tiers + some new ones
      const features: (keyof PlanQuotas['featuresUnlocked'])[] = [
        'resultsExport',
        'semanticSearch',
        'insightsAI',
        'customBranding',
        'consentMode',
        'rankingQuestions',
        'samlSso',
        'townhallQA',
        'liveCopilot',
        'crossSessionInsights',
        'recurringWorkspaces',
      ]

      for (let i = 0; i < plans.length - 1; i++) {
        const currentPlan = plans[i]
        const nextPlan = plans[i + 1]
        const currentQuotas = getQuotasForPlan(currentPlan)
        const nextQuotas = getQuotasForPlan(nextPlan)

        for (const feature of features) {
          const current = featureAllowed(currentQuotas, feature)
          const next = featureAllowed(nextQuotas, feature)
          // Next tier should have at least the same features
          if (current) {
            expect(next).toBe(true)
          }
        }
      }
    })

    it('free plan blocks all premium features', () => {
      const freeQuotas = getQuotasForPlan('free')
      expect(featureAllowed(freeQuotas, 'resultsExport')).toBe(false)
      expect(featureAllowed(freeQuotas, 'townhallQA')).toBe(false)
    })

    it('starter plan allows basic premium but not team-only', () => {
      const starterQuotas = getQuotasForPlan('starter')
      expect(featureAllowed(starterQuotas, 'resultsExport')).toBe(true)
      expect(featureAllowed(starterQuotas, 'townhallQA')).toBe(false)
    })

    it('team plan allows all features', () => {
      const teamQuotas = getQuotasForPlan('team')
      expect(featureAllowed(teamQuotas, 'resultsExport')).toBe(true)
      expect(featureAllowed(teamQuotas, 'townhallQA')).toBe(true)
      expect(featureAllowed(teamQuotas, 'crossSessionInsights')).toBe(true)
    })
  })

  describe('Middleware pattern (requireFeature)', () => {
    it('simulates middleware gate: allowed access', () => {
      const quotas = getQuotasForPlan('team')
      const feature = 'resultsExport' as const

      // Middleware check
      const allowed = featureAllowed(quotas, feature)
      expect(allowed).toBe(true)

      // Would call next() in actual middleware
      expect(allowed).toBe(true)
    })

    it('simulates middleware gate: denied access returns 403', () => {
      const quotas = getQuotasForPlan('free')
      const feature = 'resultsExport' as const

      // Middleware check
      const allowed = featureAllowed(quotas, feature)
      expect(allowed).toBe(false)

      // Would return 403 with denyFeature error
      if (!allowed) {
        const error = denyFeature('free', feature)
        expect(error.code).toMatch(/upgrade|plan|feature/)
      }
    })
  })
})
