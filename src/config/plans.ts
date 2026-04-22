// Single source of truth for frontend plan configuration.
// Quota values (sessionsPerMonth, participantsPerSession, features) must stay
// in sync with PLAN_QUOTAS in functions/api/types.ts.

export interface PlanConfig {
  id: 'free' | 'starter' | 'team'
  name: string
  description: string
  price: number
  cta: string
  ctaVariant: 'primary' | 'secondary'
  badge: string | null
  features: {
    sessionsPerMonth: number
    participantsPerSession: number
    resultsExport: boolean
    semanticSearch: boolean
    insightsAI: boolean
    customBranding: boolean
    consentMode: boolean
    rankingQuestions: boolean
  }
}

export const PLANS: PlanConfig[] = [
  {
    id: 'free',
    name: 'Free',
    description: 'Get started with interactive sessions',
    price: 0,
    cta: 'Get Started',
    ctaVariant: 'secondary',
    badge: null,
    features: {
      sessionsPerMonth: 5,
      participantsPerSession: 50,
      resultsExport: false,
      semanticSearch: false,
      insightsAI: false,
      customBranding: false,
      consentMode: false,
      rankingQuestions: false,
    },
  },
  {
    id: 'starter',
    name: 'Starter',
    description: 'For growing teams and increased engagement',
    price: 29,
    cta: 'Start Free Trial',
    ctaVariant: 'primary',
    badge: null,
    features: {
      sessionsPerMonth: 50,
      participantsPerSession: 500,
      resultsExport: true,
      semanticSearch: true,
      insightsAI: false,
      customBranding: true,
      consentMode: true,
      rankingQuestions: true,
    },
  },
  {
    id: 'team',
    name: 'Team',
    description: 'Full power — AI insights, unlimited scale',
    price: 99,
    cta: 'Start Free Trial',
    ctaVariant: 'primary',
    badge: 'Most Popular',
    features: {
      sessionsPerMonth: 500,
      participantsPerSession: 5000,
      resultsExport: true,
      semanticSearch: true,
      insightsAI: true,
      customBranding: true,
      consentMode: true,
      rankingQuestions: true,
    },
  },
]

export const CHECKOUT_URL = (import.meta.env.VITE_CHECKOUT_URL as string | undefined) ?? 'https://checkout.qesto.cc'
