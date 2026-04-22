import { Heading, Body, Section, Card, Caption } from '../ui/components'
import MainLayout from '../layouts/MainLayout'

export default function Terms() {
  return (
    <MainLayout>
      <div className="grid-container max-w-4xl px-4 md:px-6 py-12">
        <Heading level="l" className="mb-space-6">
          Terms of Service
        </Heading>

        <Body size="m" className="mb-space-8 text-pulse-600">
          Effective date: April 1, 2024. By using Qesto, you agree to these Terms of Service. Please read them
          carefully.
        </Body>

        <Section className="mb-space-8">
          <Heading level="m" className="mb-space-4">
            1. Acceptance of Terms
          </Heading>
          <Body size="m">
            By accessing or using Qesto (the "Service"), you agree to be bound by these Terms. If you do not agree
            to any part of these Terms, you may not use the Service. Your continued use of Qesto constitutes
            acceptance of any changes we make to these Terms.
          </Body>
        </Section>

        <Section className="mb-space-8">
          <Heading level="m" className="mb-space-4">
            2. Service Description
          </Heading>
          <Body size="m" className="mb-space-4">
            Qesto is a real-time interactive session platform that enables teams to create, host, and analyze
            collaborative sessions (polls, rankings, consent votes, open questions) with live participant
            engagement and AI-powered post-session insights.
          </Body>
          <Body size="m">
            Service availability is provided on an "as-is" basis. We aim for 99.5% uptime but do not guarantee
            uninterrupted access. Maintenance windows and incidents may occur.
          </Body>
        </Section>

        <Section className="mb-space-8">
          <Heading level="m" className="mb-space-4">
            3. User Eligibility
          </Heading>
          <Body size="m" className="mb-space-4">
            By using Qesto, you confirm that you:
          </Body>
          <ul className="list-disc list-inside space-y-2 ml-4">
            <li className="text-body-m">Are at least 18 years old (or have parental/guardian consent)</li>
            <li className="text-body-m">Have the authority to enter into this agreement (if using on behalf of an organization)</li>
            <li className="text-body-m">Will comply with all applicable laws and regulations in your jurisdiction</li>
            <li className="text-body-m">Will not use Qesto for illegal or harmful purposes</li>
          </ul>
        </Section>

        <Section className="mb-space-8">
          <Heading level="m" className="mb-space-4">
            4. User Responsibilities
          </Heading>
          <Body size="m" className="mb-space-4">
            You are responsible for:
          </Body>
          <ul className="list-disc list-inside space-y-2 ml-4">
            <li className="text-body-m">
              <strong>Account security:</strong> Keeping your login credentials confidential
            </li>
            <li className="text-body-m">
              <strong>Lawful use:</strong> Not using Qesto to violate laws or infringe third-party rights
            </li>
            <li className="text-body-m">
              <strong>Content:</strong> All session content you create (questions, responses, branding)
            </li>
            <li className="text-body-m">
              <strong>Consent:</strong> Obtaining informed consent from session participants before collection or
              analysis
            </li>
          </ul>
        </Section>

        <Section className="mb-space-8">
          <Heading level="m" className="mb-space-4">
            5. Intellectual Property
          </Heading>
          <Body size="m" className="mb-space-4">
            <strong>Qesto intellectual property:</strong> We retain ownership of all Qesto trademarks, code,
            designs, and documentation. You may not reverse-engineer, copy, or modify Qesto without permission.
          </Body>
          <Body size="m">
            <strong>Your content:</strong> You retain all rights to session content you create. By uploading content
            to Qesto, you grant Qesto a worldwide, non-exclusive license to host, display, and process your content
            to provide the Service (including AI Insights analysis).
          </Body>
        </Section>

        <Section className="mb-space-8">
          <Heading level="m" className="mb-space-4">
            6. Plan Quotas & Feature Gating
          </Heading>
          <Body size="m" className="mb-space-4">
            Access to features and quotas depends on your plan tier:
          </Body>
          <Card className="mt-space-4">
            <div className="space-y-4 text-body-m">
              <div>
                <strong className="block mb-space-2">Free Plan</strong>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>5 sessions/month</li>
                  <li>50 participants per session</li>
                  <li>Basic polling & consent voting</li>
                </ul>
              </div>
              <div>
                <strong className="block mb-space-2">Starter Plan</strong>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>50 sessions/month</li>
                  <li>500 participants per session</li>
                  <li>Results export, custom branding, ranking questions, semantic search</li>
                </ul>
              </div>
              <div>
                <strong className="block mb-space-2">Team Plan</strong>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>500 sessions/month (effectively unlimited)</li>
                  <li>5000 participants per session</li>
                  <li>All features + AI Insights, team collaboration, priority support</li>
                </ul>
              </div>
            </div>
          </Card>
          <Body size="m" className="mt-space-4">
            We reserve the right to modify plan quotas with 30 days' notice. Exceeding quotas may result in feature
            restrictions.
          </Body>
        </Section>

        <Section className="mb-space-8">
          <Heading level="m" className="mb-space-4">
            7. Prohibited Uses
          </Heading>
          <Body size="m" className="mb-space-4">
            You may not use Qesto to:
          </Body>
          <ul className="list-disc list-inside space-y-2 ml-4">
            <li className="text-body-m">Collect data in violation of applicable privacy laws or consent requirements</li>
            <li className="text-body-m">Create deceptive or fraudulent surveys or sessions</li>
            <li className="text-body-m">
              Attack, hack, or disrupt the Service (including denial-of-service attacks or credential stuffing)
            </li>
            <li className="text-body-m">Harass, abuse, or defame other users or participants</li>
            <li className="text-body-m">Violate third-party intellectual property, privacy, or contractual rights</li>
            <li className="text-body-m">Distribute malware or malicious content</li>
            <li className="text-body-m">Scrape, crawl, or auto-access the Service in violation of our robots.txt or API terms</li>
          </ul>
        </Section>

        <Section className="mb-space-8">
          <Heading level="m" className="mb-space-4">
            8. Content Moderation & Termination
          </Heading>
          <Body size="m" className="mb-space-4">
            We reserve the right to:
          </Body>
          <ul className="list-disc list-inside space-y-2 ml-4">
            <li className="text-body-m">Review, remove, or restrict content that violates these Terms</li>
            <li className="text-body-m">Suspend or terminate your account for violations of these Terms or applicable law</li>
            <li className="text-body-m">Delete inactive accounts after 12 months of non-use (with 30-day notice)</li>
          </ul>
          <Body size="m" className="mt-space-4">
            In case of termination, any remaining session data is retained for 6 months per our Privacy Policy and
            may be retained longer if required by law.
          </Body>
        </Section>

        <Section className="mb-space-8">
          <Heading level="m" className="mb-space-4">
            9. Refund Policy
          </Heading>
          <Body size="m">
            <strong>Refunds are non-refundable.</strong> Subscription payments are billed monthly in advance and
            cannot be refunded. You may cancel your subscription at any time; refunds will not be issued for
            partial months. We do not prorate refunds for mid-month cancellations.
          </Body>
          <Body size="m" className="mt-space-4">
            If you dispute a charge, you may contact <strong>billing@qesto.cc</strong> within 30 days for
            clarification. Disputed charges may be subject to chargeback fees.
          </Body>
        </Section>

        <Section className="mb-space-8">
          <Heading level="m" className="mb-space-4">
            10. Limitation of Liability
          </Heading>
          <Card className="mt-space-4 border-amber-200 bg-amber-50">
            <Body size="m">
              <strong>TO THE MAXIMUM EXTENT PERMITTED BY LAW:</strong> Qesto, its owners, and its service providers
              are not liable for:
            </Body>
            <ul className="list-disc list-inside space-y-2 ml-4 mt-space-3">
              <li className="text-body-m">
                <strong>Indirect damages:</strong> Lost profits, lost data, reputational harm, or lost business
                opportunity
              </li>
              <li className="text-body-m">
                <strong>Direct damages:</strong> Arising from service interruptions, data breaches (despite reasonable
                security), or third-party actions
              </li>
              <li className="text-body-m">
                <strong>AI-generated content:</strong> Inaccuracy, bias, or harmful recommendations from AI Insights
              </li>
            </ul>
            <Body size="m" className="mt-space-3">
              Our total liability under these Terms is limited to the amount you paid Qesto in the 12 months before
              the claim.
            </Body>
          </Card>
        </Section>

        <Section className="mb-space-8">
          <Heading level="m" className="mb-space-4">
            11. Indemnification
          </Heading>
          <Body size="m">
            You agree to indemnify and hold harmless Qesto from any claims, damages, or costs (including legal fees)
            arising from:
          </Body>
          <ul className="list-disc list-inside space-y-2 ml-4">
            <li className="text-body-m">Your violation of these Terms or applicable law</li>
            <li className="text-body-m">Your session content or user data collection practices</li>
            <li className="text-body-m">
              Claims by third parties that your use of Qesto infringes their intellectual property or privacy rights
            </li>
          </ul>
        </Section>

        <Section className="mb-space-8">
          <Heading level="m" className="mb-space-4">
            12. Governing Law & Jurisdiction
          </Heading>
          <Body size="m">
            These Terms are governed by the laws of [Jurisdiction: TBD], without regard to conflict-of-law
            principles. Any disputes shall be resolved by binding arbitration under [Arbitration Rules: TBD], or in
            the state/federal courts of [Jurisdiction: TBD].
          </Body>
        </Section>

        <Section className="mb-space-8">
          <Heading level="m" className="mb-space-4">
            13. Contact & Changes
          </Heading>
          <Body size="m" className="mb-space-4">
            For questions about these Terms, contact <strong>support@qesto.cc</strong>.
          </Body>
          <Body size="m">
            We may update these Terms from time to time. Material changes will be notified via email or posting on
            the site. Your continued use constitutes acceptance of the updated Terms.
          </Body>
          <Caption className="mt-space-4">Last updated: April 22, 2026</Caption>
        </Section>
      </div>
    </MainLayout>
  )
}
