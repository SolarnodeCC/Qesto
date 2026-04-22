import SolutionPageTemplate from '../../components/SolutionPageTemplate'

export default function ConsultingPage() {
  return (
    <SolutionPageTemplate
      hero={{
        badge: 'For Consultants & Facilitators',
        headline: 'Workshops that actually move the room.',
        subheadline:
          'Replace sticky notes and show-of-hands with structured real-time data. Qesto helps facilitators surface alignment, expose hidden disagreements, and close workshops with clear decisions.',
        primaryCta: { label: 'Get started free', href: '/login' },
        secondaryCta: { label: 'See pricing', href: '/pricing' },
        imageUrl: '/images/solutions/photo-1552664730-d307ca884978.avif',
        imageAlt: 'Facilitator leading a collaborative workshop session',
      }}
      painPoints={{
        heading: 'What slows workshops down',
        items: [
          {
            icon: '🤔',
            title: 'False consensus',
            desc: "Groups nod along in the room but disagree privately. You leave thinking alignment was reached — it wasn't.",
          },
          {
            icon: '🗓️',
            title: 'No data to debrief with',
            desc: 'After the session, you have photos of whiteboards and a vague memory of what was said. Clients want evidence.',
          },
          {
            icon: '⏱️',
            title: 'Time lost to logistics',
            desc: 'Sticky notes, anonymous voting cards, and counting hands eat up facilitation time that should go into thinking.',
          },
        ],
      }}
      features={{
        heading: 'Every tool a facilitator needs, in one session link',
        items: [
          {
            icon: '🏆',
            title: 'Priority ranking',
            desc: 'Surface what the group actually values most — not what the most senior person in the room says they value.',
          },
          {
            icon: '⚖️',
            title: 'Consent rounds',
            desc: 'Run structured consent checks at decision points. See objections in real time so you can address them before leaving the room.',
          },
          {
            icon: '💬',
            title: 'Anonymous open questions',
            desc: 'Collect honest responses without social pressure. AI clusters themes so you can share a clean summary at the end.',
            ai: true,
          },
          {
            icon: '📈',
            title: 'Exportable results',
            desc: 'Every session produces a shareable results report. Send clients the evidence of what their team decided.',
          },
        ],
      }}
      scenarios={{
        heading: 'Facilitation formats that use Qesto',
        items: [
          {
            title: 'Strategy alignment workshop',
            desc: 'Use ranking to prioritise strategic options, then run consent rounds on the top two. Leave with a documented decision, not a vague mandate.',
          },
          {
            title: 'Retrospective with distributed teams',
            desc: 'Run anonymous open questions across timezones in async mode. AI surfaces the top 5 themes for a synchronous debrief.',
          },
          {
            title: 'Design thinking ideation',
            desc: 'Use open questions to generate ideas, then ranking to prioritise them. The team sees live aggregated results on their own devices.',
          },
        ],
      }}
      bottomCta={{
        heading: 'Run better workshops, close with data.',
        subheading: 'Set up your first session in under 5 minutes.',
        primaryCta: { label: 'Start for free', href: '/login' },
        secondaryCta: { label: 'View pricing', href: '/pricing' },
      }}
    />
  )
}
