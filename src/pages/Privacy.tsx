import { Heading, Body, Section, Card, Caption } from '../ui/components'
import MainLayout from '../layouts/MainLayout'

export default function Privacy() {
  return (
    <MainLayout>
      <div className="w-full max-w-4xl mx-auto px-4 md:px-6 py-12 space-y-8">
        <Heading level="l">
          Privacy Policy
        </Heading>

        <Body size="m" className="text-pulse-600">
          Effective date: April 1, 2024. Qesto is committed to protecting your privacy while enabling
          collaborative, real-time interactive sessions.
        </Body>

        <Section className="space-y-4">
          <Heading level="m">
            1. Information We Collect
          </Heading>
          <Body size="m">
            When you create an account or run a session, we collect:
          </Body>
          <ul className="list-disc list-inside space-y-2 ml-4">
            <li className="text-body-m">
              <strong>Account data:</strong> Email, display name, authentication tokens (JWT)
            </li>
            <li className="text-body-m">
              <strong>Session data:</strong> Session title, questions, participant responses (anonymized by
              default)
            </li>
            <li className="text-body-m">
              <strong>Usage data:</strong> Sessions created, participants, feature adoption (for anonymity
              analytics)
            </li>
            <li className="text-body-m">
              <strong>Technical data:</strong> IP address, user agent, WebSocket connection metadata
            </li>
          </ul>
        </Section>

        <Section className="space-y-4">
          <Heading level="m" className="mb-space-4">
            2. How We Use Your Data
          </Heading>
          <Body size="m">
            We use collected data to:
          </Body>
          <ul className="list-disc list-inside space-y-2 ml-4">
            <li className="text-body-m">Provide and maintain Qesto services (session hosting, realtime updates)</li>
            <li className="text-body-m">Enforce plan quotas (session/participant limits per your plan tier)</li>
            <li className="text-body-m">Generate AI-powered insights (optional, plan-gated feature)</li>
            <li className="text-body-m">Comply with legal obligations and prevent abuse</li>
            <li className="text-body-m">
              Improve the platform through aggregate analytics (never sharing individual identities)
            </li>
          </ul>
        </Section>

        <Section className="space-y-4">
          <Heading level="m" className="mb-space-4">
            3. Data Retention
          </Heading>
          <Body size="m">
            We retain data for operational and legal purposes:
          </Body>
          <Card className="mt-space-4 bg-blue-50 border-blue-200">
            <ul className="list-disc list-inside space-y-2">
              <li className="text-body-m">
                <strong>Session data:</strong> Retained for 6 months after closure (supports insights and audit)
              </li>
              <li className="text-body-m">
                <strong>Account data:</strong> Retained until account deletion; backup retained for 90 days
              </li>
              <li className="text-body-m">
                <strong>Audit logs:</strong> Retained for 12 months for security and compliance
              </li>
              <li className="text-body-m">
                <strong>Magic link tokens:</strong> Expired after 15 minutes; not retained beyond expiry
              </li>
            </ul>
          </Card>
        </Section>

        <Section className="space-y-4">
          <Heading level="m" className="mb-space-4">
            4. Your Rights
          </Heading>
          <Body size="m">
            Under GDPR (EU), CCPA (California), and other privacy laws, you have the right to:
          </Body>
          <ul className="list-disc list-inside space-y-2 ml-4">
            <li className="text-body-m">
              <strong>Access:</strong> Request a copy of all data we hold about you
            </li>
            <li className="text-body-m">
              <strong>Rectification:</strong> Correct inaccurate or incomplete data
            </li>
            <li className="text-body-m">
              <strong>Erasure:</strong> Request deletion of your account and associated data (within retention
              windows)
            </li>
            <li className="text-body-m">
              <strong>Portability:</strong> Export your sessions and responses in machine-readable format
            </li>
            <li className="text-body-m">
              <strong>Opt-out:</strong> Disable AI Insights, analytics, or marketing communications
            </li>
          </ul>
          <Body size="m" className="mt-space-4">
            To exercise these rights, contact <strong>privacy@qesto.cc</strong>.
          </Body>
        </Section>

        <Section className="space-y-4">
          <Heading level="m" className="mb-space-4">
            5. Third-Party Integrations
          </Heading>
          <Body size="m">
            We use the following third parties on your behalf:
          </Body>
          <Card className="mt-space-4">
            <div className="space-y-4">
              <div>
                <strong className="text-body-m block mb-space-2">Stripe (Payment Processing)</strong>
                <Body size="s">
                  Processes subscription payments. Card data is encrypted and never stored by Qesto. See{' '}
                  <a href="https://stripe.com/privacy" className="text-teal-600 hover:underline">
                    Stripe's privacy policy
                  </a>
                  .
                </Body>
              </div>
              <div>
                <strong className="text-body-m block mb-space-2">Cloudflare Workers AI (Optional)</strong>
                <Body size="s">
                  When you enable AI Insights (Pro/Team only), Qesto runs inference on Cloudflare Workers AI
                  (not Anthropic). Prompts are run in-region and not stored for training. See{' '}
                  <a href="https://www.cloudflare.com/privacy/" className="text-teal-600 hover:underline">
                    Cloudflare's privacy policy
                  </a>
                  .
                </Body>
              </div>
              <div>
                <strong className="text-body-m block mb-space-2">Resend (Email Delivery)</strong>
                <Body size="s">
                  Delivers magic-link login emails and account notifications. See{' '}
                  <a href="https://resend.com/privacy" className="text-teal-600 hover:underline">
                    Resend's privacy policy
                  </a>
                  .
                </Body>
              </div>
            </div>
          </Card>
        </Section>

        <Section className="space-y-4">
          <Heading level="m" className="mb-space-4">
            6. Security
          </Heading>
          <Body size="m">
            We implement industry-standard security practices:
          </Body>
          <ul className="list-disc list-inside space-y-2 ml-4">
            <li className="text-body-m">
              <strong>Transport:</strong> All data transmitted over HTTPS (TLS 1.3)
            </li>
            <li className="text-body-m">
              <strong>Authentication:</strong> JWT-based magic-link auth; optional SAML SSO (Enterprise)
            </li>
            <li className="text-body-m">
              <strong>Database:</strong> Encrypted at rest on Cloudflare D1; access restricted to authorized
              functions
            </li>
            <li className="text-body-m">
              <strong>Audit logging:</strong> All sensitive actions (session access, data export, plan changes)
              logged
            </li>
          </ul>
          <Body size="m" className="mt-space-4">
            If you discover a security vulnerability, please email <strong>security@qesto.cc</strong>.
          </Body>
        </Section>

        <Section className="space-y-4">
          <Heading level="m" className="mb-space-4">
            7. Cookies & Tracking
          </Heading>
          <Body size="m">
            Qesto uses minimal tracking. We do not use third-party analytics (Google Analytics, Mixpanel, etc.).
            Session cookies are used only for authentication; no persistent tracking across sites.
          </Body>
        </Section>

        <Section className="space-y-4">
          <Heading level="m" className="mb-space-4">
            8. Contact & Questions
          </Heading>
          <Body size="m">
            For privacy inquiries, contact:
          </Body>
          <Card className="mt-space-4 bg-pulse-50">
            <div className="text-body-m space-y-2">
              <div>
                <strong>Email:</strong> privacy@qesto.cc
              </div>
              <div>
                <strong>Data Protection Officer (if applicable):</strong> dpo@qesto.cc
              </div>
              <div>
                <strong>Address:</strong> Qesto, contact form at https://qesto.cc
              </div>
            </div>
          </Card>
        </Section>

        <Section className="mb-space-12">
          <Heading level="m" className="mb-space-4">
            9. Changes to This Policy
          </Heading>
          <Body size="m">
            We may update this policy from time to time. We will notify you of material changes via email or by
            posting a notice on the site.
          </Body>
          <Caption className="mt-space-4">Last updated: April 22, 2026</Caption>
        </Section>
      </div>
    </MainLayout>
  )
}
