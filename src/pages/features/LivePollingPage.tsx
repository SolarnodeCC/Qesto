import FeaturePageTemplate from '../../components/FeaturePageTemplate'

export default function LivePollingPage() {
  return (
    <FeaturePageTemplate
      hero={{
        badge: 'Core feature',
        headline: 'Live polling that moves at the speed of your room.',
        subheadline:
          'Multiple choice, scales, rankings, open questions, and consent votes — all updating in real time on every participant\'s device and your presenter screen simultaneously.',
        primaryCta: { label: 'Try it free', href: '/login' },
        secondaryCta: { label: 'See pricing', href: '/pricing' },
      }}
      howItWorks={{
        heading: 'From question to result in under 10 seconds',
        steps: [
          {
            number: 1,
            title: 'Share a join code',
            desc: 'Participants join at qesto.cc and enter a 6-character code — no app download, no account, no friction.',
          },
          {
            number: 2,
            title: 'Activate questions one by one',
            desc: 'As the host you control timing — reveal questions when the room is ready and close voting when discussion begins.',
          },
          {
            number: 3,
            title: 'See results live on screen',
            desc: 'A live-updating bar chart, ranking leaderboard, or word cloud appears on the presenter view and participants\' devices simultaneously.',
          },
        ],
      }}
      outcomes={{
        heading: 'Why teams switch to Qesto',
        items: [
          {
            icon: '🌍',
            metric: 'Global edge',
            desc: 'Every vote routes through Cloudflare\'s network — sub-100ms response times regardless of where participants are.',
          },
          {
            icon: '👥',
            metric: 'Up to 5,000',
            desc: 'Participants per session on the Team plan — no infrastructure provisioning, no warm-up delays.',
          },
          {
            icon: '🗳️',
            metric: '6 question types',
            desc: 'Multiple choice, scale, open text, ranking, points allocation, and consent — one tool for every engagement format.',
          },
        ],
      }}
      related={{
        heading: 'See live polling in action',
        links: [
          { label: 'Qesto for Events', href: '/events', desc: 'Audience polling and Q&A ranking for conferences and keynotes.' },
          { label: 'Qesto for Education', href: '/education', desc: 'Real-time formative assessment and student engagement in lectures.' },
          { label: 'Use case: Team Meetings', href: '/use-cases/team-meetings', desc: 'Quick polls and retro check-ins that replace silent nodding.' },
        ],
      }}
      bottomCta={{
        heading: 'Your audience is waiting to be heard.',
        subheading: 'No app install. No waiting. Just join and vote.',
        primaryCta: { label: 'Start for free', href: '/login' },
        secondaryCta: { label: 'View pricing', href: '/pricing' },
      }}
    />
  )
}
