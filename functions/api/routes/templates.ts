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
import type { Env, Question } from '../types'

type Vars = AuthVariables & PlanVariables

interface TemplateDefinition {
  id: string
  name: string
  description: string
  category: string
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
    const list = listRaw ? (JSON.parse(listRaw) as string[]) : []

    for (const templateId of list) {
      const key = `customer_template:${userId}:${templateId}`
      const raw = await c.env.TEMPLATES_KV.get(key)
      if (raw) {
        templates.push(JSON.parse(raw) as CustomerTemplate)
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
    const body = (await c.req.json().catch(() => null)) as unknown

    // Validation
    if (
      typeof body !== 'object' ||
      body === null ||
      typeof (body as Record<string, unknown>).sessionId !== 'string' ||
      typeof (body as Record<string, unknown>).name !== 'string'
    ) {
      return c.json(
        {
          ok: false,
          error: { code: 'validation', message: 'Missing or invalid sessionId and name' },
          trace_id: c.get('trace_id'),
        },
        400,
      )
    }

    const { sessionId, name, description = '' } = body as {
      sessionId: string
      name: string
      description?: string
    }

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

    const questions = (questionRows ?? []).map((row: Record<string, unknown>) => ({
      kind: row.kind as Question['kind'],
      prompt: row.prompt as string,
      options: JSON.parse(row.options_json as string),
    }))

    // Create template
    const templateId = ulid()
    const template: CustomerTemplate = {
      id: templateId,
      type: 'customer',
      userId,
      name,
      description,
      category: 'custom',
      questions,
      createdAt: Date.now(),
    }

    // Store template
    const key = `customer_template:${userId}:${templateId}`
    await c.env.TEMPLATES_KV.put(key, JSON.stringify(template), { expirationTtl: 86400 * 365 })

    // Update list
    const listKey = `customer_templates_list:${userId}`
    const listRaw = await c.env.TEMPLATES_KV.get(listKey)
    const list = listRaw ? (JSON.parse(listRaw) as string[]) : []
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
    const list = listRaw ? (JSON.parse(listRaw) as string[]) : []
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
