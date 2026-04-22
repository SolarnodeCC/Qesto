import FeaturePageTemplate from '../../components/FeaturePageTemplate'

export default function PrivacyFeaturePage() {
  return (
    <FeaturePageTemplate
      hero={{
        badge: 'Privacy by default',
        headline: 'Your team\'s responses stay yours — always.',
        subheadline:
          'Anonymity modes, GDPR consent logging, and on-device AI inference mean participants can speak honestly and you can prove it. No third-party model providers ever see your data.',
        primaryCta: { label: 'Get started free', href: '/login' },
        secondaryCta: { label: 'Read our privacy policy', href: '/privacy' },
      }}
      howItWorks={{
        heading: 'Privacy is architecture, not a checkbox',
        steps: [
          {
            number: 1,
            title: 'AI runs on the edge',
            desc: 'All AI inference — question generation, theme detection, semantic search — uses Cloudflare Workers AI. Your session data never leaves the edge.',
          },
          {
            number: 2,
            title: 'Anonymity is configurable per session',
            desc: 'Choose from three levels: individual (responses linked to participant), cohort (aggregated by group), or full (no linkage possible). Participants see their anonymity level before joining.',
          },
          {
            number: 3,
            title: 'Consent votes are logged immutably',
            desc: 'Every consent decision is recorded with a cryptographic timestamp at the Cloudflare edge — audit-ready for GDPR, ISO 27001, or internal governance requirements.',
          },
        ],
      }}
      outcomes={{
        heading: 'What privacy-first means in practice',
        items: [
          {
            icon: '🔒',
            metric: 'Zero third-party AI',
            desc: 'No OpenAI, no Anthropic, no Google. Workers AI only — your data stays on Cloudflare\'s infrastructure.',
          },
          {
            icon: '📋',
            metric: 'GDPR-ready logs',
            desc: 'Consent records are exportable for data subject access requests or regulatory audits in seconds.',
          },
          {
            icon: '🛡️',
            metric: 'Anonymous by default',
            desc: 'New sessions start in full-anonymity mode. Hosts must actively choose to enable individual linking.',
          },
        ],
      }}
      related={{
        heading: 'Privacy matters most here',
        links: [
          { label: 'Qesto for Enterprise', href: '/enterprise', desc: 'SAML SSO, GDPR DPA, and team-level audit logs for regulated industries.' },
          { label: 'Qesto for HR', href: '/hr', desc: 'Anonymous pulse surveys your employees will actually trust.' },
          { label: 'Qesto for Nonprofits', href: '/nonprofit', desc: 'Consent-first community voting with tamper-evident audit trails.' },
        ],
      }}
      bottomCta={{
        heading: 'Honest responses start with trusted infrastructure.',
        subheading: 'Privacy is on by default — you never have to turn it on.',
        primaryCta: { label: 'Start for free', href: '/login' },
        secondaryCta: { label: 'Read our privacy policy', href: '/privacy' },
      }}
    />
  )
}
