import FeaturePageTemplate from '../../components/FeaturePageTemplate'

export default function AIInsightsPage() {
  return (
    <FeaturePageTemplate
      hero={{
        ai: true,
        headline: 'AI Insights — questions written in seconds, patterns found automatically.',
        subheadline:
          'Qesto\'s on-device AI generates question sets from a brief, detects themes across sessions, and surfaces what your team is really thinking — without a single byte leaving your infrastructure.',
        primaryCta: { label: 'Try it free', href: '/login' },
        secondaryCta: { label: 'See pricing', href: '/pricing' },
      }}
      howItWorks={{
        heading: 'How AI Insights works',
        steps: [
          {
            number: 1,
            title: 'Describe your goal',
            desc: 'Type a one-line brief — "30-minute retro for a remote engineering team" — and Qesto drafts a complete question set tailored to your context.',
          },
          {
            number: 2,
            title: 'Run your session live',
            desc: 'Participants join by code on any device. Responses arrive in real time, anonymised by default.',
          },
          {
            number: 3,
            title: 'Review AI-detected themes',
            desc: 'After the session closes, the Insights tab groups open responses into labelled themes with a confidence score — no manual tagging required.',
          },
        ],
      }}
      outcomes={{
        heading: 'What teams experience',
        items: [
          {
            icon: '⚡',
            metric: 'Under 90 seconds',
            desc: 'Median time from blank page to a complete AI-generated question set.',
          },
          {
            icon: '🔒',
            metric: '100% on-device',
            desc: 'All inference runs on Cloudflare Workers AI. Your data never reaches an external model provider.',
          },
          {
            icon: '✦',
            metric: '≥30% acceptance',
            desc: 'Target acceptance rate for AI-suggested questions — most teams keep more than they edit.',
          },
        ],
      }}
      related={{
        heading: 'See AI Insights in context',
        links: [
          { label: 'Qesto for HR', href: '/hr', desc: 'Anonymous pulse surveys with AI theme detection across all-hands sessions.' },
          { label: 'Qesto for Consulting', href: '/consulting', desc: 'AI clusters workshop responses so facilitators share clean debrief summaries.' },
          { label: 'Use case: Workshops', href: '/use-cases/workshops', desc: 'Step-by-step guide to running AI-assisted facilitation sessions.' },
        ],
      }}
      bottomCta={{
        heading: 'Stop staring at a blank question list.',
        subheading: 'Let AI draft it. You refine it. Your team answers it.',
        primaryCta: { label: 'Start for free', href: '/login' },
        secondaryCta: { label: 'View pricing', href: '/pricing' },
      }}
    />
  )
}
