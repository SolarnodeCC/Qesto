// Curated Qesto seed templates + KV seeding helper. Split out of templates.ts
// (Jankurai code-shape) — this is pure data plus a one-time seeding routine.
import type { Question } from '../types'
import { TEMPLATE_TTL_SECONDS } from '../lib/constants'

export interface TemplateDefinition {
  id: string
  name: string
  description: string
  category: string
  topic: string
  previewAlt: string
  questions: Array<{
    kind: Question['kind']
    prompt: string
    options: Array<{ id: string; label: string }>
  }>
}

export interface QuestoTemplate extends TemplateDefinition {
  type: 'qesto'
}

// Lazy-initialized seed templates
export const SEED_TEMPLATES: QuestoTemplate[] = [
  {
    id: 'tmpl-retro',
    type: 'qesto',
    name: 'Team Retrospective',
    description: 'Reflect on what went well, what could improve, and actionable next steps.',
    category: 'team',
    topic: 'team',
    previewAlt: 'Retrospective template preview with sprint health, learning, and priority questions',
    questions: [
      {
        kind: 'poll',
        prompt: 'How would you rate this sprint overall? (1=poor, 10=excellent)',
        options: Array.from({ length: 10 }, (_, i) => ({ id: `s${i + 1}`, label: String(i + 1) })),
      },
      {
        kind: 'open',
        prompt: 'What went well this sprint?',
        options: [],
      },
      {
        kind: 'open',
        prompt: 'What could we improve?',
        options: [],
      },
      {
        kind: 'poll',
        prompt: 'How motivated are you about the work ahead? (1=not at all, 10=very)',
        options: Array.from({ length: 10 }, (_, i) => ({ id: `m${i + 1}`, label: String(i + 1) })),
      },
      {
        kind: 'ranking',
        prompt: 'Rank the top 3 priorities for next sprint',
        options: [
          { id: 'p1', label: 'Feature development' },
          { id: 'p2', label: 'Technical debt' },
          { id: 'p3', label: 'Team morale & growth' },
          { id: 'p4', label: 'Customer support' },
        ],
      },
    ],
  },
  {
    id: 'tmpl-feedback',
    type: 'qesto',
    name: 'Product Feedback',
    description: 'Gather structured feedback on a product, feature, or initiative.',
    category: 'product',
    topic: 'product',
    previewAlt: 'Product feedback template preview with recommendation, value, and improvement questions',
    questions: [
      {
        kind: 'poll',
        prompt: 'How likely are you to recommend this feature to a colleague?',
        options: [
          { id: 'vl', label: 'Very likely' },
          { id: 'l', label: 'Likely' },
          { id: 'u', label: 'Unsure' },
          { id: 'u2', label: 'Unlikely' },
          { id: 'vu', label: 'Very unlikely' },
        ],
      },
      {
        kind: 'poll',
        prompt: 'Rate the ease of use (1=very difficult, 10=very easy)',
        options: Array.from({ length: 10 }, (_, i) => ({ id: `e${i + 1}`, label: String(i + 1) })),
      },
      {
        kind: 'poll',
        prompt: 'Rate the value you receive (1=no value, 10=exceptional value)',
        options: Array.from({ length: 10 }, (_, i) => ({ id: `v${i + 1}`, label: String(i + 1) })),
      },
      {
        kind: 'open',
        prompt: 'What would make this feature even better?',
        options: [],
      },
    ],
  },
  {
    id: 'tmpl-icebreaker',
    type: 'qesto',
    name: 'Icebreaker',
    description: 'Quick get-to-know-you session to build team connection.',
    category: 'team',
    topic: 'team',
    previewAlt: 'Icebreaker template preview with connection-building open questions',
    questions: [
      {
        kind: 'open',
        prompt: "What's one thing you're proud of this week?",
        options: [],
      },
      {
        kind: 'open',
        prompt: "What's your favorite way to unwind after work?",
        options: [],
      },
      {
        kind: 'open',
        prompt: 'If you could learn one new skill instantly, what would it be?',
        options: [],
      },
    ],
  },
  {
    id: 'tmpl-team-health',
    type: 'qesto',
    name: 'Team Health Check',
    description: 'Understand workload, clarity, energy, and collaboration risks before they become blockers.',
    category: 'team',
    topic: 'team',
    previewAlt: 'Team health template preview with workload, clarity, and collaboration checks',
    questions: [
      {
        kind: 'likert',
        prompt: 'I have the clarity I need to do my best work this week.',
        options: [],
      },
      {
        kind: 'poll',
        prompt: 'How sustainable does the current workload feel?',
        options: [
          { id: 'great', label: 'Very sustainable' },
          { id: 'ok', label: 'Mostly sustainable' },
          { id: 'strained', label: 'Strained' },
          { id: 'risk', label: 'At risk' },
        ],
      },
      {
        kind: 'open',
        prompt: 'What is one thing that would make next week easier?',
        options: [],
      },
    ],
  },
  {
    id: 'tmpl-decision-sync',
    type: 'qesto',
    name: 'Decision Sync',
    description: 'Align stakeholders around options, trade-offs, confidence, and next actions.',
    category: 'team',
    topic: 'team',
    previewAlt: 'Decision sync template preview with option ranking and confidence checks',
    questions: [
      {
        kind: 'ranking',
        prompt: 'Rank the options from strongest to weakest for our goal.',
        options: [
          { id: 'option-a', label: 'Option A' },
          { id: 'option-b', label: 'Option B' },
          { id: 'option-c', label: 'Option C' },
        ],
      },
      {
        kind: 'poll',
        prompt: 'How confident are you that we can execute the leading option?',
        options: [
          { id: 'high', label: 'High confidence' },
          { id: 'medium', label: 'Medium confidence' },
          { id: 'low', label: 'Low confidence' },
        ],
      },
      {
        kind: 'open',
        prompt: 'What risk should we explicitly manage?',
        options: [],
      },
    ],
  },
  {
    id: 'tmpl-feature-prioritization',
    type: 'qesto',
    name: 'Feature Prioritization',
    description: 'Compare product bets by customer value, effort, urgency, and confidence.',
    category: 'product',
    topic: 'product',
    previewAlt: 'Feature prioritization template preview with ranked product bets and confidence checks',
    questions: [
      {
        kind: 'ranking',
        prompt: 'Rank these opportunities by customer impact.',
        options: [
          { id: 'bet-a', label: 'Opportunity A' },
          { id: 'bet-b', label: 'Opportunity B' },
          { id: 'bet-c', label: 'Opportunity C' },
          { id: 'bet-d', label: 'Opportunity D' },
        ],
      },
      {
        kind: 'poll',
        prompt: 'Which bet has the strongest evidence today?',
        options: [
          { id: 'a', label: 'Opportunity A' },
          { id: 'b', label: 'Opportunity B' },
          { id: 'c', label: 'Opportunity C' },
          { id: 'd', label: 'Opportunity D' },
        ],
      },
      {
        kind: 'open',
        prompt: 'What evidence would change your prioritization?',
        options: [],
      },
    ],
  },
  {
    id: 'tmpl-beta-readiness',
    type: 'qesto',
    name: 'Beta Readiness Review',
    description: 'Check launch confidence, known issues, customer fit, and support readiness.',
    category: 'product',
    topic: 'product',
    previewAlt: 'Beta readiness template preview with launch confidence and support questions',
    questions: [
      {
        kind: 'poll',
        prompt: 'How ready is this feature for a beta audience?',
        options: [
          { id: 'ready', label: 'Ready now' },
          { id: 'minor', label: 'Minor fixes needed' },
          { id: 'major', label: 'Major risks remain' },
          { id: 'not-ready', label: 'Not ready' },
        ],
      },
      {
        kind: 'multi_select',
        prompt: 'Where do we still need confidence?',
        options: [
          { id: 'ux', label: 'UX quality' },
          { id: 'support', label: 'Support readiness' },
          { id: 'performance', label: 'Performance' },
          { id: 'security', label: 'Security/privacy' },
        ],
      },
      {
        kind: 'open',
        prompt: 'What must be true before we invite more users?',
        options: [],
      },
    ],
  },
  {
    id: 'tmpl-training-check',
    type: 'qesto',
    name: 'Training Pulse Check',
    description: 'Measure learning confidence and collect questions during a workshop or training.',
    category: 'learning',
    topic: 'learning',
    previewAlt: 'Training pulse template preview with comprehension and open question prompts',
    questions: [
      {
        kind: 'poll',
        prompt: 'How confident do you feel applying what we just covered?',
        options: [
          { id: 'very', label: 'Very confident' },
          { id: 'somewhat', label: 'Somewhat confident' },
          { id: 'unsure', label: 'Unsure' },
          { id: 'not-yet', label: 'Not yet confident' },
        ],
      },
      {
        kind: 'word_cloud',
        prompt: 'Which concept should we revisit?',
        options: [],
      },
      {
        kind: 'open',
        prompt: 'What question would you like answered before we move on?',
        options: [],
      },
    ],
  },
  {
    id: 'tmpl-workshop-close',
    type: 'qesto',
    name: 'Workshop Closeout',
    description: 'End a workshop with commitment, confidence, and practical next steps.',
    category: 'learning',
    topic: 'learning',
    previewAlt: 'Workshop closeout template preview with action commitments and confidence questions',
    questions: [
      {
        kind: 'open',
        prompt: 'What is one action you will take after this workshop?',
        options: [],
      },
      {
        kind: 'poll',
        prompt: 'How useful was today for your day-to-day work?',
        options: [
          { id: 'very', label: 'Very useful' },
          { id: 'useful', label: 'Useful' },
          { id: 'somewhat', label: 'Somewhat useful' },
          { id: 'not', label: 'Not useful' },
        ],
      },
      {
        kind: 'open',
        prompt: 'What should we improve for the next workshop?',
        options: [],
      },
    ],
  },
  {
    id: 'tmpl-event-qa',
    type: 'qesto',
    name: 'Event Q&A Triage',
    description: 'Collect, upvote, and prioritize audience questions during events.',
    category: 'learning',
    topic: 'learning',
    previewAlt: 'Event Q and A template preview with upvoted audience question prompts',
    questions: [
      {
        kind: 'upvote',
        prompt: 'Add or upvote the question you most want answered.',
        options: [],
      },
      {
        kind: 'poll',
        prompt: 'Which topic should we spend more time on?',
        options: [
          { id: 'strategy', label: 'Strategy' },
          { id: 'implementation', label: 'Implementation' },
          { id: 'examples', label: 'Examples' },
          { id: 'qa', label: 'Open Q&A' },
        ],
      },
      {
        kind: 'open',
        prompt: 'What should we send as follow-up material?',
        options: [],
      },
    ],
  },
]

/**
 * Lazy-initialize seed templates on first access
 */
export async function ensureSeedTemplates(kv: KVNamespace) {
  const seeded = await kv.get('qesto_templates_seeded')
  if (!seeded) {
    for (const tmpl of SEED_TEMPLATES) {
      await kv.put(`qesto_template:${tmpl.id}`, JSON.stringify(tmpl), { expirationTtl: TEMPLATE_TTL_SECONDS })
    }
    await kv.put('qesto_templates_seeded', 'true', { expirationTtl: TEMPLATE_TTL_SECONDS })
  }
}
