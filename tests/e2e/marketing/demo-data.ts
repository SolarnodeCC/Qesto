/** Marketing-safe copy for product demo recordings — no test junk or PII. */
export const MARKETING_DEMO = {
  host: {
    displayName: 'Alex Rivera',
    password: 'DemoShowcase2026!',
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
