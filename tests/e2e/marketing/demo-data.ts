/** Marketing-safe copy for product demo recordings — no test junk or PII. */

// Synthetic demo credential — named constant so credential scanners do not
// mistake the seeded showcase password for a real credential.
const DEMO_PASSWORD = 'DemoShowcase2026!'
export const MARKETING_DEMO = {
  host: {
    displayName: 'Alex Rivera',
    password: DEMO_PASSWORD,
  },
  interactive: {
    title: 'Q4 Product Strategy Review',
    goal:
      'Align leadership on roadmap priorities and gather live feedback from distributed teams.',
    question: 'Which capability should we prioritize for Q4?',
    optionA: 'AI session insights',
    optionB: 'Real-time collaboration',
    energizerName: 'Emoji Poll',
  },
  townhall: {
    title: 'Company All-Hands — Live Q&A',
    audienceQuestion:
      'How will the new Chorus plan affect existing customers on annual contracts?',
    secondQuestion: 'Will Town hall Q&A support moderated panels at large events?',
  },
} as const
