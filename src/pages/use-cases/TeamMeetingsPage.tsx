import SolutionPageTemplate from '../../components/SolutionPageTemplate'

export default function TeamMeetingsPage() {
  return (
    <SolutionPageTemplate
      hero={{
        badge: 'Use case: Team Meetings',
        headline: 'Meetings where everyone contributes, not just the loudest.',
        subheadline:
          'Replace silent nodding with structured input. Qesto makes standups, retrospectives, and decision meetings faster, more inclusive, and actually useful.',
        primaryCta: { label: 'Get started free', href: '/login' },
        secondaryCta: { label: 'See pricing', href: '/pricing' },
        imageUrl: '/images/solutions/photo-1551434678-e076c223a692.avif',
        imageAlt: 'Team collaborating around a table in a meeting',
      }}
      painPoints={{
        heading: 'What makes team meetings frustrating',
        items: [
          {
            icon: '🔇',
            title: 'Silent agreement',
            desc: 'People nod along rather than risk conflict. Decisions get made without real buy-in and fall apart in execution.',
          },
          {
            icon: '⏱️',
            title: 'Time eaten by discussion',
            desc: 'One topic balloons to fill the whole slot. The agenda items that actually matter get dropped.',
          },
          {
            icon: '🤷',
            title: 'No record of what was decided',
            desc: 'Meeting notes capture action items but not the reasoning. Two weeks later nobody remembers why the decision was made.',
          },
        ],
      }}
      features={{
        heading: 'Qesto tools for better team meetings',
        items: [
          {
            icon: '⚡',
            title: 'Quick pulse polls',
            desc: 'A 30-second scale question at the start of any meeting tells you the energy level and surfaces blockers before you begin.',
          },
          {
            icon: '🏆',
            title: 'Priority ranking',
            desc: 'Let the team rank agenda items or backlog priorities before the meeting. The room knows what to spend time on.',
          },
          {
            icon: '✅',
            title: 'Consent rounds',
            desc: 'Test for genuine agreement before closing a decision. See objections live so you can address them — not discover them two weeks later.',
          },
          {
            icon: '📊',
            title: 'Exportable session recap',
            desc: 'Every session produces a shareable results snapshot. Drop it into Slack or Notion as the meeting record.',
          },
        ],
      }}
      scenarios={{
        heading: 'Meeting formats that work well with Qesto',
        items: [
          {
            title: 'Weekly team retro',
            desc: 'Anonymous open questions for "what went well / what to improve". AI groups the responses so the team discusses patterns, not individual complaints.',
          },
          {
            title: 'Sprint planning prioritisation',
            desc: 'Use ranking to let the team vote on backlog items before the planning call starts. The call becomes alignment, not debate.',
          },
          {
            title: 'Decision check-in',
            desc: 'Run a consent round before closing any significant decision. One click shows whether the team has real objections or genuine buy-in.',
          },
        ],
      }}
      bottomCta={{
        heading: 'Turn your next meeting into a real conversation.',
        subheading: 'Join codes work on any device — no app install for participants.',
        primaryCta: { label: 'Start for free', href: '/login' },
        secondaryCta: { label: 'View pricing', href: '/pricing' },
      }}
    />
  )
}
