// Template system — Qesto curated templates + customer-created templates.
//
// Routes:
//   GET    /api/templates           list all Qesto (public) templates; supports ?category= filter
//   GET    /api/templates/:id       fetch single Qesto template with full question definitions
//   GET    /api/templates/mine      list current user's saved templates (auth required)
//   POST   /api/templates/mine      save a session as a template (auth required)
//   DELETE /api/templates/mine/:id  delete own template (auth required)
//
// Curated seed data + KV seeding live in ./templates-seed (Jankurai code-shape).

import { Hono } from 'hono'
import { ulid } from '../lib/ulid'
import { readKvText, writeKvJson, deleteKv } from '../lib/kv'
import { authMiddleware, type AuthVariables } from '../middleware/auth'
import type { PlanVariables } from '../middleware/plan'
import { validateBody } from '../lib/request-validation'
import { CreateTemplateSchema } from '../lib/domain-schemas'
import { validateKvJson, TemplateIdArraySchema, CustomerTemplateSchema, PollOptionArraySchema } from '../lib/protocol-schemas'
import type { Env, Question } from '../types'
import { TEMPLATE_TTL_SECONDS } from '../lib/constants'
import { type TemplateDefinition, type QuestoTemplate, SEED_TEMPLATES, ensureSeedTemplates } from './templates-seed'

type Vars = AuthVariables & PlanVariables

interface CustomerTemplate extends TemplateDefinition {
  type: 'customer'
  userId: string
  createdAt: number
  // ENTERPRISE-POLISH s6a/s6b: scope + versioning
  scope?: 'personal' | 'team' | 'organization'
  ownedByTeamId?: string
  version?: number
  parentId?: string
  updatedAt?: number
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
    const listRaw = await readKvText(c.env.TEMPLATES_KV, listKey)
    const list = validateKvJson(listRaw, TemplateIdArraySchema) ?? []

    for (const templateId of list) {
      const key = `customer_template:${userId}:${templateId}`
      const raw = await readKvText(c.env.TEMPLATES_KV, key)
      if (raw) {
        const template = validateKvJson(raw, CustomerTemplateSchema)
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
        options = validateKvJson(row.options_json as string, PollOptionArraySchema) ?? []
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
    await writeKvJson(c.env.TEMPLATES_KV, key, template, { expirationTtl: TEMPLATE_TTL_SECONDS })

    // Update list
    const listKey = `customer_templates_list:${userId}`
    const listRaw = await readKvText(c.env.TEMPLATES_KV, listKey)
    const list = validateKvJson(listRaw, TemplateIdArraySchema) ?? []
    list.push(templateId)
    await writeKvJson(c.env.TEMPLATES_KV, listKey, list, { expirationTtl: TEMPLATE_TTL_SECONDS })

    return c.json(
      {
        ok: true,
        data: { template },
        trace_id: c.get('trace_id'),
      },
      201,
    )
  })

  // PATCH /api/templates/mine/:id -- update name/description/scope (auth required).
  // ENTERPRISE-POLISH s6a/s6b: bumps version, stores parentId, allows scope change.
  app.patch('/mine/:id', authMiddleware, async (c) => {
    const user = c.get('user')
    const userId = user.sub
    const templateId = c.req.param('id')
    const body = await c.req.json().catch(() => null) as Record<string, unknown> | null
    if (!body) {
      return c.json({ ok: false, error: { code: 'bad_request', message: 'Request body required' }, trace_id: c.get('trace_id') }, 400)
    }
    const key = `customer_template:${userId}:${templateId}`
    const raw = await readKvText(c.env.TEMPLATES_KV, key)
    if (!raw) {
      return c.json({ ok: false, error: { code: 'not_found', message: 'Template not found' }, trace_id: c.get('trace_id') }, 404)
    }
    const existing = validateKvJson(raw, CustomerTemplateSchema) as CustomerTemplate | null
    if (!existing) {
      return c.json({ ok: false, error: { code: 'invalid_state', message: 'Corrupted template record' }, trace_id: c.get('trace_id') }, 500)
    }
    const updated: CustomerTemplate = {
      ...existing,
      ...(typeof body.name === 'string' ? { name: body.name.trim() } : {}),
      ...(typeof body.description === 'string' ? { description: body.description.trim() } : {}),
      ...(body.scope === 'team' || body.scope === 'organization' || body.scope === 'personal'
          ? { scope: body.scope as 'personal' | 'team' | 'organization' } : {}),
      ...(typeof body.ownedByTeamId === 'string' ? { ownedByTeamId: body.ownedByTeamId } : {}),
      version: (existing.version ?? 1) + 1,
      parentId: existing.id,
      updatedAt: Date.now(),
    }
    await writeKvJson(c.env.TEMPLATES_KV, key, updated, { expirationTtl: TEMPLATE_TTL_SECONDS })
    return c.json({ ok: true, data: { template: updated }, trace_id: c.get('trace_id') })
  })

  // DELETE /api/templates/mine/:id -- delete own template (auth required)
  app.delete('/mine/:id', authMiddleware, async (c) => {
    const user = c.get('user')
    const userId = user.sub
    const templateId = c.req.param('id')

    const key = `customer_template:${userId}:${templateId}`
    const raw = await readKvText(c.env.TEMPLATES_KV, key)

    if (!raw) {
      return c.json(
        { ok: false, error: { code: 'not_found', message: 'Template not found' }, trace_id: c.get('trace_id') },
        404,
      )
    }

    // Delete template
    await deleteKv(c.env.TEMPLATES_KV, key)

    // Update list
    const listKey = `customer_templates_list:${userId}`
    const listRaw = await readKvText(c.env.TEMPLATES_KV, listKey)
    const list = validateKvJson(listRaw, TemplateIdArraySchema) ?? []
    const idx = list.indexOf(templateId)
    if (idx >= 0) {
      list.splice(idx, 1)
      await writeKvJson(c.env.TEMPLATES_KV, listKey, list, { expirationTtl: TEMPLATE_TTL_SECONDS })
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
