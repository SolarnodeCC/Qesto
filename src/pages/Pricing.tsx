import { Heading, Body, Section, Card, Button, Badge } from '../ui/components'
import MainLayout from '../layouts/MainLayout'

export default function Pricing() {
  const plans = [
    {
      name: 'Free',
      description: 'Get started with interactive sessions',
      price: 0,
      cta: 'Get Started',
      ctaVariant: 'secondary' as const,
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
      name: 'Starter',
      description: 'For growing teams and increased engagement',
      price: 29,
      cta: 'Start Free Trial',
      ctaVariant: 'primary' as const,
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
      name: 'Team',
      description: 'Full power — AI insights, unlimited scale',
      price: 99,
      cta: 'Start Free Trial',
      ctaVariant: 'primary' as const,
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

  const featureRows = [
    { key: 'sessionsPerMonth', label: 'Sessions per month' },
    { key: 'participantsPerSession', label: 'Participants per session' },
    { key: 'resultsExport', label: 'Results export (CSV)' },
    { key: 'semanticSearch', label: 'Semantic search' },
    { key: 'consentMode', label: 'Consent voting' },
    { key: 'rankingQuestions', label: 'Ranking questions' },
    { key: 'customBranding', label: 'Custom branding' },
    { key: 'insightsAI', label: 'AI Insights & analysis' },
  ]

  return (
    <MainLayout>
      <div className="w-full max-w-6xl mx-auto px-4 md:px-6 py-12 space-y-12">
        {/* Header */}
        <div className="max-w-3xl mx-auto text-center space-y-4">
          <Heading level="l">
            Simple, Transparent Pricing
          </Heading>
          <Body size="l" className="text-pulse-600">
            Choose the plan that fits your team. Always in control. No long-term contracts.
          </Body>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full">
          {plans.map((plan) => (
            <Card
              key={plan.name}
              className={`flex flex-col relative ${
                plan.badge ? 'ring-2 ring-teal-500 lg:scale-105 lg:origin-bottom' : ''
              }`}
            >
              {plan.badge && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <Badge variant="success">{plan.badge}</Badge>
                </div>
              )}

              <div className="flex-1">
                <Heading level="s" className="mb-space-2">
                  {plan.name}
                </Heading>
                <Body size="s" className="text-pulse-600 mb-space-4">
                  {plan.description}
                </Body>

                <div className="mb-space-6">
                  <div className="flex items-baseline gap-1">
                    <span className="text-display-l font-bold">${plan.price}</span>
                    <span className="text-body-m text-pulse-500">/month</span>
                  </div>
                  {plan.price > 0 && (
                    <Body size="s" className="text-pulse-500 mt-space-1">
                      Billed monthly. Cancel anytime.
                    </Body>
                  )}
                </div>

                <Button
                  variant={plan.ctaVariant}
                  className="w-full mb-space-6"
                  onClick={() => {
                    // TODO: Wire up checkout/signup based on plan
                    window.location.href =
                      plan.price === 0
                        ? '/login'
                        : `https://checkout.qesto.cc?plan=${plan.name.toLowerCase()}`
                  }}
                >
                  {plan.cta}
                </Button>

                {/* Quick feature list */}
                <div className="space-y-2 border-t border-pulse-200 pt-space-4">
                  {plan.name === 'Free' ? (
                    <>
                      <Body size="s">
                        <strong>{plan.features.sessionsPerMonth}</strong> sessions/month
                      </Body>
                      <Body size="s">
                        <strong>{plan.features.participantsPerSession}</strong> participants max
                      </Body>
                      <Body size="s">Basic polls & consent voting</Body>
                    </>
                  ) : (
                    <>
                      <Body size="s">
                        <strong>{plan.features.sessionsPerMonth}</strong> sessions/month
                      </Body>
                      <Body size="s">
                        <strong>{plan.features.participantsPerSession}</strong> participants max
                      </Body>
                      {plan.features.insightsAI && (
                        <Body size="s">
                          <strong>AI Insights</strong> included
                        </Body>
                      )}
                      {!plan.features.insightsAI && (
                        <Body size="s">Core features + export & search</Body>
                      )}
                    </>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Feature Comparison Table */}
        <Section className="space-y-6">
          <Heading level="m" className="text-center">
            Detailed Feature Comparison
          </Heading>

          <div className="overflow-x-auto">
            <table className="w-full text-body-s">
              <thead>
                <tr className="border-b-2 border-pulse-300">
                  <th className="text-left py-3 px-4 font-semibold text-pulse-700">Feature</th>
                  <th className="text-center py-3 px-4 font-semibold text-pulse-700">Free</th>
                  <th className="text-center py-3 px-4 font-semibold text-pulse-700">Starter</th>
                  <th className="text-center py-3 px-4 font-semibold text-pulse-700">Team</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-pulse-200">
                {featureRows.map((row) => (
                  <tr key={row.key} className="hover:bg-pulse-50">
                    <td className="py-3 px-4 font-medium text-pulse-900">{row.label}</td>
                    {plans.map((plan) => {
                      const value = plan.features[row.key as keyof typeof plan.features]
                      return (
                        <td key={plan.name} className="text-center py-3 px-4">
                          {typeof value === 'boolean' ? (
                            value ? (
                              <span className="text-teal-600 font-semibold">✓</span>
                            ) : (
                              <span className="text-pulse-300">−</span>
                            )
                          ) : (
                            <span className="font-semibold text-pulse-900">{value}</span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* FAQ Section */}
        <Section className="max-w-3xl mx-auto space-y-6">
          <Heading level="m" className="text-center">
            Frequently Asked Questions
          </Heading>

          <div className="space-y-6">
            <Card>
              <Heading level="s" className="mb-space-2">
                Can I upgrade or downgrade my plan?
              </Heading>
              <Body size="m">
                Yes! Change your plan anytime from your account settings. Upgrades take effect immediately;
                downgrades take effect at the next billing cycle.
              </Body>
            </Card>

            <Card>
              <Heading level="s" className="mb-space-2">
                Is there a free trial?
              </Heading>
              <Body size="m">
                Yes. Starter and Team plans include a 14-day free trial. No credit card required to start.
              </Body>
            </Card>

            <Card>
              <Heading level="s" className="mb-space-2">
                What payment methods do you accept?
              </Heading>
              <Body size="m">
                We accept all major credit cards (Visa, Mastercard, American Express) via Stripe. Annual billing
                discounts are available upon request.
              </Body>
            </Card>

            <Card>
              <Heading level="s" className="mb-space-2">
                What happens if I exceed my quota?
              </Heading>
              <Body size="m">
                We'll notify you when you're approaching your limit. Once exceeded, you can create new sessions but
                will need to upgrade your plan or wait for the monthly reset.
              </Body>
            </Card>

            <Card>
              <Heading level="s" className="mb-space-2">
                Do you offer enterprise or custom plans?
              </Heading>
              <Body size="m">
                Yes! For large teams, custom requirements, or annual contracts, contact sales@qesto.cc for a custom
                quote.
              </Body>
            </Card>

            <Card>
              <Heading level="s" className="mb-space-2">
                What's your refund policy?
              </Heading>
              <Body size="m">
                Subscription payments are non-refundable. You can cancel your subscription at any time, and you
                won't be charged after the current billing cycle. See our <a href="/terms" className="text-teal-600 hover:underline">Terms of Service</a> for details.
              </Body>
            </Card>
          </div>
        </Section>

        {/* CTA Footer */}
        <div className="max-w-3xl mx-auto text-center pt-6 border-t border-pulse-200 space-y-4">
          <Heading level="m">
            Ready to get started?
          </Heading>
          <Body size="m" className="text-pulse-600">
            Join thousands of teams running interactive sessions with Qesto.
          </Body>
          <Button variant="primary" onClick={() => (window.location.href = '/login')}>
            Start Your Free Session
          </Button>
          <Body size="s" className="text-pulse-500">
            Have questions? <a href="mailto:sales@qesto.cc" className="text-teal-600 hover:underline">Contact our team</a>
          </Body>
        </div>
      </div>
    </MainLayout>
  )
}
