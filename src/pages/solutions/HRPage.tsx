import SolutionPageTemplate from '../../components/SolutionPageTemplate'

export default function HRPage() {
  return (
    <SolutionPageTemplate
      hero={{
        badge: 'For HR & People Teams',
        headline: 'Feel the pulse of your people — not just the data.',
        subheadline:
          'Run anonymous pulse surveys, onboarding check-ins, and engagement sessions that employees actually respond to. AI surfaces what your team is really thinking.',
        primaryCta: { label: 'Get started free', href: '/login' },
        secondaryCta: { label: 'See pricing', href: '/pricing' },
        imageUrl: '/images/solutions/photo-1543269865-cbf427effbad.avif',
        imageAlt: 'HR team in a collaborative discussion',
      }}
      painPoints={{
        heading: "The gaps annual surveys can't fill",
        items: [
          {
            icon: '📅',
            title: 'Stale once-a-year data',
            desc: 'Annual engagement surveys tell you how people felt six months ago. By the time results are ready, the moment to act has passed.',
          },
          {
            icon: '🤐',
            title: 'Fear of speaking up',
            desc: "Employees self-censor when they think responses aren't truly anonymous. Honest feedback stays locked inside people's heads.",
          },
          {
            icon: '📋',
            title: 'Survey fatigue',
            desc: 'Long questionnaires get abandoned halfway through. Completion rates drop every quarter as people learn nothing will change.',
          },
        ],
      }}
      features={{
        heading: 'A better way to listen at scale',
        items: [
          {
            icon: '🔒',
            title: 'Anonymity modes',
            desc: 'Three levels of anonymity — individual, cohort, and full — so employees share honestly without fear.',
          },
          {
            icon: '⚡',
            title: 'Pulse sessions in minutes',
            desc: 'Run a focused 5-question check-in after any all-hands or team event. No survey tool licence needed.',
          },
          {
            icon: '🤖',
            title: 'AI theme detection',
            desc: 'Qesto clusters open-text responses across sessions so HR can see patterns before they become problems.',
            ai: true,
          },
          {
            icon: '📊',
            title: 'GDPR consent log',
            desc: 'Every consent vote is cryptographically logged at the edge. Audit-ready from day one.',
          },
        ],
      }}
      scenarios={{
        heading: 'How people teams use Qesto',
        items: [
          {
            title: 'All-hands pulse check',
            desc: 'Follow every company meeting with a quick three-question session. Track sentiment trends across quarters without asking people to log into yet another tool.',
          },
          {
            title: 'New hire onboarding check-in',
            desc: 'Run a 30-day and 90-day anonymous check-in for new starters. AI flags themes early so you can intervene before churn.',
          },
          {
            title: 'Manager effectiveness survey',
            desc: 'Collect upward feedback anonymously. Teams speak candidly; managers get aggregated themes, not individual accusations.',
          },
        ],
      }}
      bottomCta={{
        heading: 'Build a culture where everyone has a voice.',
        subheading: 'Start free — no HR software integration required.',
        primaryCta: { label: 'Start for free', href: '/login' },
        secondaryCta: { label: 'View pricing', href: '/pricing' },
      }}
    />
  )
}
