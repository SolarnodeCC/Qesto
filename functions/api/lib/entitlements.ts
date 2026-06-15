import type { PlanQuotas, PlanTier, QuestionKind } from '../types'

export type FeatureKey = keyof PlanQuotas['featuresUnlocked']

export type EntitlementDenial = {
  code: 'feature_not_available' | 'limit_exceeded'
  message: string
  details: {
    current_plan: PlanTier
    upgrade_url: string
    feature?: FeatureKey
    limit?: number
    used?: number
  }
}

export function questionKindFeature(kind: QuestionKind): FeatureKey | null {
  if (kind === 'ranking') return 'rankingQuestions'
  if (kind === 'consent') return 'consentMode'
  if (kind === 'reaction') return 'liveReactions'
  return null
}

export function denyFeature(plan: PlanTier, feature: FeatureKey): EntitlementDenial {
  return {
    code: 'feature_not_available',
    message: `Feature '${feature}' is not available on your plan`,
    details: {
      feature,
      current_plan: plan,
      upgrade_url: '/billing/upgrade',
    },
  }
}

export function denyLimit(plan: PlanTier, message: string, limit: number, used: number): EntitlementDenial {
  return {
    code: 'limit_exceeded',
    message,
    details: {
      current_plan: plan,
      upgrade_url: '/billing/upgrade',
      limit,
      used,
    },
  }
}

export function maxTeamMembersForPlan(plan: PlanTier): number {
  if (plan === 'team') return 10
  if (plan === 'starter') return 3
  return 1
}

export function featureAllowed(quotas: PlanQuotas, feature: FeatureKey): boolean {
  return quotas.featuresUnlocked[feature] === true
}
