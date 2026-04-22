import SolutionPageTemplate from '../../components/SolutionPageTemplate'

export default function NonprofitPage() {
  return (
    <SolutionPageTemplate
      hero={{
        badge: 'For Nonprofits & Communities',
        headline: 'Give every member a voice that counts.',
        subheadline:
          'Run transparent votes, consent checks, and community feedback sessions that keep your members engaged and your board accountable — all on a privacy-first platform.',
        primaryCta: { label: 'Get started free', href: '/login' },
        secondaryCta: { label: 'See pricing', href: '/pricing' },
        imageUrl: '/images/solutions/photo-1681949103006-70066fb25dfe.avif',
        imageAlt: 'Community group in a collaborative session',
      }}
      painPoints={{
        heading: 'What gets in the way of real community voice',
        items: [
          {
            icon: '🙋',
            title: 'Attendance bias',
            desc: 'Only people who show up to in-person meetings get to vote. Remote or time-constrained members are effectively excluded.',
          },
          {
            icon: '🗳️',
            title: 'Opaque voting',
            desc: 'Paper ballots and show-of-hands feel untrustworthy. Members question whether their input actually counts.',
          },
          {
            icon: '📢',
            title: 'Loudest voice wins',
            desc: 'A few vocal members dominate discussions. Quieter contributors — often the majority — stay silent.',
          },
        ],
      }}
      features={{
        heading: 'Tools built for transparent, inclusive decisions',
        items: [
          {
            icon: '✅',
            title: 'Consent voting',
            desc: 'Structured consent rounds surface genuine agreement or block-level objections — not just majority opinion.',
          },
          {
            icon: '🔒',
            title: 'Anonymous participation',
            desc: 'Members share honestly without social pressure. Anonymity modes are configurable per session.',
          },
          {
            icon: '🌍',
            title: '5-language support',
            desc: 'Run sessions in English, Dutch, German, French, or Spanish — reach every member in their first language.',
          },
          {
            icon: '📋',
            title: 'GDPR consent log',
            desc: 'Every vote and consent record is stored with a tamper-evident audit trail — perfect for AGMs and governance reports.',
          },
        ],
      }}
      scenarios={{
        heading: 'How nonprofits and communities use Qesto',
        items: [
          {
            title: 'Annual general meeting voting',
            desc: 'Run board elections and policy votes live or async. Every member can participate from wherever they are.',
          },
          {
            title: 'Community priority-setting',
            desc: 'Use ranking sessions to surface what programmes your members value most before budget decisions are made.',
          },
          {
            title: 'Volunteer feedback loops',
            desc: 'Run a quick pulse after volunteer events to see what worked. AI summarises open responses so coordinators act on themes, not anecdotes.',
          },
        ],
      }}
      bottomCta={{
        heading: 'Democracy starts with being heard.',
        subheading: 'Free plan available. No credit card required.',
        primaryCta: { label: 'Start for free', href: '/login' },
        secondaryCta: { label: 'View pricing', href: '/pricing' },
      }}
    />
  )
}
