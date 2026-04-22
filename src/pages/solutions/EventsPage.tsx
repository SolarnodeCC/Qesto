import SolutionPageTemplate from '../../components/SolutionPageTemplate'

export default function EventsPage() {
  return (
    <SolutionPageTemplate
      hero={{
        badge: 'For Events & Conferences',
        headline: 'Turn every keynote into a conversation.',
        subheadline:
          'Run live polls, Q&A rankings, and sentiment checks across hundreds of participants — Qesto keeps your audience engaged from opening remarks to closing session.',
        primaryCta: { label: 'Get started free', href: '/login' },
        secondaryCta: { label: 'See pricing', href: '/pricing' },
        imageUrl: '/images/solutions/photo-1572021335469-31706a17aaef.avif',
        imageAlt: 'Speaker presenting at a conference with engaged audience',
      }}
      painPoints={{
        heading: 'The challenges every event organiser knows',
        items: [
          {
            icon: '😶',
            title: 'Passive audiences',
            desc: 'Attendees scroll their phones while speakers talk to a quiet room. Engagement drops off after the first 10 minutes.',
          },
          {
            icon: '🐢',
            title: 'Slow feedback loops',
            desc: 'Post-event surveys arrive too late to act on. You only find out what went wrong after people have left.',
          },
          {
            icon: '🔇',
            title: 'Silent majority',
            desc: 'Only the loudest voices get heard in open Q&A. Most attendees never feel safe enough to share their real opinions.',
          },
        ],
      }}
      features={{
        heading: 'Everything you need to run a live event people remember',
        subheading: 'From pre-session warm-ups to post-keynote debrief, Qesto has a question type for every moment.',
        items: [
          {
            icon: '📊',
            title: 'Live polls',
            desc: 'Instant multiple-choice and scale questions that update in real time on the big screen.',
          },
          {
            icon: '🏆',
            title: 'Priority ranking',
            desc: 'Let audiences vote on session topics, speaker questions, or workshop themes — results surface the crowd consensus.',
          },
          {
            icon: '💬',
            title: 'Open questions',
            desc: 'Collect free-text responses anonymously. AI clusters similar answers so speakers see themes, not noise.',
            ai: true,
          },
          {
            icon: '✅',
            title: 'Consent checks',
            desc: 'Run audience agreement polls before sensitive topics — see live consensus without putting anyone on the spot.',
          },
        ],
      }}
      scenarios={{
        heading: 'How event teams use Qesto',
        items: [
          {
            title: 'Keynote warm-up poll',
            desc: "Open with a fun question to prime the audience. Energy spikes, phones come down, and you get instant data on who's in the room.",
          },
          {
            title: 'Live speaker Q&A ranking',
            desc: 'Attendees submit and upvote questions in real time. Speakers answer the ones that matter most — no awkward microphone relay needed.',
          },
          {
            title: 'Post-session pulse check',
            desc: 'A 60-second scale question at the end of each talk tells you what landed and what to adjust for the afternoon programme.',
          },
        ],
      }}
      bottomCta={{
        heading: 'Your next event starts here.',
        subheading: 'Set up in under 5 minutes, no app install required for attendees.',
        primaryCta: { label: 'Start for free', href: '/login' },
        secondaryCta: { label: 'View pricing', href: '/pricing' },
      }}
    />
  )
}
