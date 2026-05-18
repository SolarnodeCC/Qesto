// Template system — Qesto curated templates + customer-created templates.
//
// Routes:
//   GET    /api/templates           list all Qesto (public) templates; supports ?category= filter
//   GET    /api/templates/:id       fetch single Qesto template with full question definitions
//   GET    /api/templates/mine      list current user's saved templates (auth required)
//   POST   /api/templates/mine      save a session as a template (auth required)
//   DELETE /api/templates/mine/:id  delete own template (auth required)

import { Hono } from 'hono'
import { ulid } from '../lib/ulid'
import { authMiddleware, type AuthVariables } from '../middleware/auth'
import type { PlanVariables } from '../middleware/plan'
import { validateBody } from '../lib/validate'
import { CreateTemplateSchema } from '../lib/validation'
import { validateData, TemplateIdArraySchema, CustomerTemplateSchema, PollOptionArraySchema } from '../lib/validators'
import type { Env, Question } from '../types'

type Vars = AuthVariables & PlanVariables

interface TemplateDefinition {
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

interface QuestoTemplate extends TemplateDefinition {
  type: 'qesto'
}

interface CustomerTemplate extends TemplateDefinition {
  type: 'customer'
  userId: string
  createdAt: number
}

// Lazy-initialized seed templates
const SEED_TEMPLATES: QuestoTemplate[] = [
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
async function ensureSeedTemplates(kv: KVNamespace) {
  const seeded = await kv.get('qesto_templates_seeded')
  if (!seeded) {
    for (const tmpl of SEED_TEMPLATES) {
      await kv.put(`qesto_template:${tmpl.id}`, JSON.stringify(tmpl), { expirationTtl: 86400 * 365 })
    }
    await kv.put('qesto_templates_seeded', 'true', { expirationTtl: 86400 * 365 })
  }
}

export function mountTemplateRoutes(parent: Hono<{ Bindings: Env; Variables: Vars }>) {
  const app = new Hono<{ Bindings: Env; Variables: Vars }>()

  // GET /api/templates — list all Qesto templates (public, no auth)
  app.get('/', async (c) => {
    await ensureSeedTemplates(c.env.TEMPLATES_KV)

    const category = c.req.query('category')
    const templates: QuestoTemplate[] = []

    for (const tmpl of SEED_TEMPLATES) {
      if (!category || tmpl.category === category) {
        templates.push(tmpl)
      }
    }

    return c.json({
      ok: true,
      data: { templates },
      trace_id: c.get('trace_id'),
    })
  })

  // GET /api/templates/mine — list current user's saved templates (auth required)
  app.get('/mine', authMiddleware, async (c) => {
    const user = c.get('user')
    const userId = user.sub
    const templates: CustomerTemplate[] = []

    // Scan KV for customer_template:{userId}:*
    // (KV list API is not available in Workers, so we check a known key pattern)
    // For Phase 1, we'll store templates with sequential IDs.
    const listKey = `customer_templates_list:${userId}`
    const listRaw = await c.env.TEMPLATES_KV.get(listKey)
    const list = listRaw ? (validateData(JSON.parse(listRaw), TemplateIdArraySchema) ?? []) : []

    for (const templateId of list) {
      const key = `customer_template:${userId}:${templateId}`
      const raw = await c.env.TEMPLATES_KV.get(key)
      if (raw) {
        const template = validateData(JSON.parse(raw), CustomerTemplateSchema)
        if (template) {
          templates.push(template as CustomerTemplate)
        }
      }
    }

    return c.json({
      ok: true,
      data: { templates },
      trace_id: c.get('trace_id'),
    })
  })

  // POST /api/templates/mine — save a session as a template (auth required)
  // Expects: { sessionId: string, name: string, description?: string }
  app.post('/mine', authMiddleware, async (c) => {
    const user = c.get('user')
    const userId = user.sub

    const validated = await validateBody(c, CreateTemplateSchema)
    if ('error' in validated) return validated.error
    const { sessionId, name, description = '' } = validated.data

    // Fetch session and its questions
    const sessionRow = await c.env.DB
      .prepare(
        `SELECT id, owner_id, code, title, status, anonymity,
                created_at, started_at, closed_at, archived_at
           FROM sessions
          WHERE id = ?1 AND owner_id = ?2`,
      )
      .bind(sessionId, userId)
      .first()

    if (!sessionRow) {
      return c.json(
        {
          ok: false,
          error: { code: 'not_found', message: 'Session not found' },
          trace_id: c.get('trace_id'),
        },
        404,
      )
    }

    const { results: questionRows } = await c.env.DB
      .prepare(
        `SELECT id, session_id, position, kind, prompt, options_json, created_at
           FROM questions
          WHERE session_id = ?1
          ORDER BY position ASC`,
      )
      .bind(sessionId)
      .all()

    const questions = (questionRows ?? []).map((row: Record<string, unknown>) => {
      let options: Array<{ id: string; label: string }> = []
      try {
        options = validateData(JSON.parse(row.options_json as string), PollOptionArraySchema) ?? []
      } catch {
        options = []
      }
      return {
        kind: row.kind as Question['kind'],
        prompt: row.prompt as string,
        options,
      }
    })

    // Create template
    const templateId = ulid()
    const template: CustomerTemplate = {
      id: templateId,
      type: 'customer',
      userId,
      name,
      description,
      category: 'custom',
      topic: 'customer',
      previewAlt: `Customer template preview for ${name}`,
      questions,
      createdAt: Date.now(),
    }

    // Store template
    const key = `customer_template:${userId}:${templateId}`
    await c.env.TEMPLATES_KV.put(key, JSON.stringify(template), { expirationTtl: 86400 * 365 })

    // Update list
    const listKey = `customer_templates_list:${userId}`
    const listRaw = await c.env.TEMPLATES_KV.get(listKey)
    const list = listRaw ? (validateData(JSON.parse(listRaw), TemplateIdArraySchema) ?? []) : []
    list.push(templateId)
    await c.env.TEMPLATES_KV.put(listKey, JSON.stringify(list), { expirationTtl: 86400 * 365 })

    return c.json(
      {
        ok: true,
        data: { template },
        trace_id: c.get('trace_id'),
      },
      201,
    )
  })

  // DELETE /api/templates/mine/:id — delete own template (auth required)
  app.delete('/mine/:id', authMiddleware, async (c) => {
    const user = c.get('user')
    const userId = user.sub
    const templateId = c.req.param('id')

    const key = `customer_template:${userId}:${templateId}`
    const raw = await c.env.TEMPLATES_KV.get(key)

    if (!raw) {
      return c.json(
        { ok: false, error: { code: 'not_found', message: 'Template not found' }, trace_id: c.get('trace_id') },
        404,
      )
    }

    // Delete template
    await c.env.TEMPLATES_KV.delete(key)

    // Update list
    const listKey = `customer_templates_list:${userId}`
    const listRaw = await c.env.TEMPLATES_KV.get(listKey)
    const list = listRaw ? (validateData(JSON.parse(listRaw), TemplateIdArraySchema) ?? []) : []
    const idx = list.indexOf(templateId)
    if (idx >= 0) {
      list.splice(idx, 1)
      await c.env.TEMPLATES_KV.put(listKey, JSON.stringify(list), { expirationTtl: 86400 * 365 })
    }

    return c.json({
      ok: true,
      data: { id: templateId },
      trace_id: c.get('trace_id'),
    })
  })

  // GET /api/templates/:id — fetch single Qesto template (public, no auth)
  // Must be registered after /mine to avoid matching "mine" as a template id.
  app.get('/:id', async (c) => {
    await ensureSeedTemplates(c.env.TEMPLATES_KV)

    const id = c.req.param('id')
    const tmpl = SEED_TEMPLATES.find((t) => t.id === id)

    if (!tmpl) {
      return c.json(
        { ok: false, error: { code: 'not_found', message: 'Template not found' }, trace_id: c.get('trace_id') },
        404,
      )
    }

    return c.json({
      ok: true,
      data: { template: tmpl },
      trace_id: c.get('trace_id'),
    })
  })

  parent.route('/api/templates', app)
}
