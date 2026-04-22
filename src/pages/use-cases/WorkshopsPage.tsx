import SolutionPageTemplate from '../../components/SolutionPageTemplate'

export default function WorkshopsPage() {
  return (
    <SolutionPageTemplate
      hero={{
        badge: 'Use case: Workshops & Facilitation',
        headline: 'Facilitate without the sticky notes.',
        subheadline:
          'Real-time structured input replaces physical props and messy whiteboards. Run ideation, prioritisation, and consent rounds from a single session link — and leave with exportable results.',
        primaryCta: { label: 'Get started free', href: '/login' },
        secondaryCta: { label: 'See pricing', href: '/pricing' },
        imageUrl: '/images/solutions/photo-1704652070195-61e76e1466db.avif',
        imageAlt: 'Workshop participants collaborating on a shared activity',
      }}
      painPoints={{
        heading: 'What slows workshops down',
        items: [
          {
            icon: '📌',
            title: 'Physical facilitation props',
            desc: 'Sticky notes, voting dots, and flip charts take time to set up and produce data you can\'t easily analyse or share.',
          },
          {
            icon: '🌐',
            title: 'Distributed participants',
            desc: 'Remote participants can\'t stick notes on a board. Hybrid workshops leave online attendees as passive observers.',
          },
          {
            icon: '📄',
            title: 'Results that disappear',
            desc: 'A photo of a whiteboard isn\'t a deliverable. Clients expect structured output; manual transcription takes hours.',
          },
        ],
      }}
      features={{
        heading: 'One session link for every workshop format',
        items: [
          {
            icon: '💡',
            title: 'Open idea collection',
            desc: 'Capture everyone\'s ideas in parallel — no groupthink, no waiting for turns. Responses arrive simultaneously.',
          },
          {
            icon: '🏆',
            title: 'Live dot voting',
            desc: 'Ranking questions let participants prioritise ideas in real time. Results update live on the presenter screen.',
          },
          {
            icon: '🤖',
            title: 'AI response clustering',
            desc: 'Open responses are automatically grouped into labelled themes. The facilitator reviews a summary, not 50 raw answers.',
            ai: true,
          },
          {
            icon: '📈',
            title: 'Shareable results',
            desc: 'Every session generates a results report you can share as a link or export. The deliverable writes itself.',
          },
        ],
      }}
      scenarios={{
        heading: 'Workshop formats that use Qesto',
        items: [
          {
            title: 'Design thinking ideation',
            desc: 'Use open questions for divergent thinking, then ranking for convergent selection. AI groups similar ideas so the team sees patterns, not a pile of text.',
          },
          {
            title: 'Values and principles session',
            desc: 'Collect what matters most to each person anonymously, then run a ranking to find genuine shared values — not just the CEO\'s personal list.',
          },
          {
            title: 'Hybrid team offsite',
            desc: 'In-room and remote participants engage identically — everyone on their own device, voting together in real time.',
          },
        ],
      }}
      bottomCta={{
        heading: 'Great facilitation leaves evidence.',
        subheading: 'Qesto turns workshop conversations into structured, shareable results.',
        primaryCta: { label: 'Start for free', href: '/login' },
        secondaryCta: { label: 'View pricing', href: '/pricing' },
      }}
    />
  )
}
