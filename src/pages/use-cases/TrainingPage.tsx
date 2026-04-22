import SolutionPageTemplate from '../../components/SolutionPageTemplate'

export default function TrainingPage() {
  return (
    <SolutionPageTemplate
      hero={{
        badge: 'Use case: Training & Learning',
        headline: 'Check understanding while you still have the room.',
        subheadline:
          'Run formative knowledge checks, confidence surveys, and reflection questions mid-session. Find out what participants actually understood — not what they said they understood.',
        primaryCta: { label: 'Get started free', href: '/login' },
        secondaryCta: { label: 'See pricing', href: '/pricing' },
        imageUrl: '/images/solutions/photo-1434030216411-0b793f4b4173.avif',
        imageAlt: 'Trainer leading an interactive learning session',
      }}
      painPoints={{
        heading: 'Why training assessments usually fail',
        items: [
          {
            icon: '😴',
            title: 'Passive listening',
            desc: 'Without structured checkpoints, participants drift. Information in one ear and out the other.',
          },
          {
            icon: '🙋',
            title: '"Any questions?" silence',
            desc: 'Nobody wants to admit they didn\'t understand. Trainers assume comprehension; participants leave confused.',
          },
          {
            icon: '📝',
            title: 'Post-training surveys nobody reads',
            desc: 'End-of-course feedback forms arrive days after the learning. Too late to adjust, too late to re-teach.',
          },
        ],
      }}
      features={{
        heading: 'Qesto tools for training sessions',
        items: [
          {
            icon: '🎯',
            title: 'Formative knowledge checks',
            desc: 'Multiple-choice questions mid-session reveal misconceptions while you can still correct them.',
          },
          {
            icon: '📊',
            title: 'Confidence scales',
            desc: 'Ask "How confident are you applying this?" at the end of each module. Spot which topics need a second pass.',
          },
          {
            icon: '💬',
            title: 'Anonymous reflection questions',
            desc: 'Open questions let participants articulate what they learned without the pressure of being called on.',
          },
          {
            icon: '🤖',
            title: 'AI learning summary',
            desc: 'After the session, AI groups participant responses to open questions — giving trainers a quick digest of what landed.',
            ai: true,
          },
        ],
      }}
      scenarios={{
        heading: 'Training scenarios where Qesto helps',
        items: [
          {
            title: 'Mid-module knowledge check',
            desc: 'Pause after each module for a 3-question multiple-choice check. Live results show the trainer exactly where to spend more time before moving on.',
          },
          {
            title: 'End-of-day reflection',
            desc: 'A quick open question at 5pm — "What\'s your one key takeaway?" — reinforces learning and gives trainers instant signal on day quality.',
          },
          {
            title: 'Pre-training baseline',
            desc: 'Run a knowledge and confidence survey before the course begins. Compare against end results to demonstrate measurable learning outcomes.',
          },
        ],
      }}
      bottomCta={{
        heading: 'Train smarter — check understanding while it matters.',
        subheading: 'No app required. Participants join by code on any device.',
        primaryCta: { label: 'Start for free', href: '/login' },
        secondaryCta: { label: 'View pricing', href: '/pricing' },
      }}
    />
  )
}
