// Marketing templates endpoints — public template gallery and session creation from templates.

import { Hono } from 'hono'
import { nanoid } from 'nanoid'
import { getTemplate, listTemplates, incrementUsageCount, type Industry, type Theme, type Lang } from '../lib/templates-kv'
import type { Env } from '../types'
import { type AuthVariables } from '../middleware/auth'
import type { PlanVariables } from '../middleware/plan'

type Vars = AuthVariables & PlanVariables

export function mountMarketingTemplateRoutes(parent: Hono<{ Bindings: Env; Variables: Vars }>) {
  const app = new Hono<{ Bindings: Env; Variables: Vars }>()

  /**
   * GET /api/templates
   * List all public templates with optional filters.
   *
   * Query params:
   *   - industry?: Industry
   *   - theme?: Theme
   *   - lang?: Lang
   *   - limit?: number (default 20)
   *   - offset?: number (default 0)
   */
  app.get('/', async (c) => {
  const kv = c.env.MARKETING_KV
  if (!kv) {
    return c.json({ error: 'MARKETING_KV not available' }, 503)
  }

  const industry = c.req.query('industry') as Industry | undefined
  const theme = c.req.query('theme') as Theme | undefined
  const lang = c.req.query('lang') as Lang | undefined
  const limit = parseInt(c.req.query('limit') || '20', 10)
  const offset = parseInt(c.req.query('offset') || '0', 10)

  try {
    const filters: { industry?: Industry; theme?: Theme; lang?: Lang } = {}
    if (industry) filters.industry = industry
    if (theme) filters.theme = theme
    if (lang) filters.lang = lang

    const templates = await listTemplates(kv, filters)

    // Sort by createdAt DESC, then apply pagination
    templates.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    const paginated = templates.slice(offset, offset + limit)

    return c.json({
      ok: true,
      data: paginated,
      pagination: {
        limit,
        offset,
        total: templates.length,
      },
    })
  } catch (err) {
    console.log({
      event: 'api.templates.list.error',
      error: err instanceof Error ? err.message : String(err),
    })
    return c.json({ error: 'Failed to list templates' }, 500)
  }
})

/**
 * GET /api/templates/:id
 * Fetch a single template by ID.
 */
  app.get('/:id', async (c) => {
  const kv = c.env.MARKETING_KV
  if (!kv) {
    return c.json({ error: 'MARKETING_KV not available' }, 503)
  }

  const templateId = c.req.param('id')

  try {
    const template = await getTemplate(kv, templateId)

    if (!template) {
      return c.json({ error: 'Template not found' }, 404)
    }

    if (template.isDiscarded) {
      return c.json({ error: 'Template not found' }, 404)
    }

    return c.json({ ok: true, data: template })
  } catch (err) {
    console.log({
      event: 'api.templates.get.error',
      templateId,
      error: err instanceof Error ? err.message : String(err),
    })
    return c.json({ error: 'Failed to fetch template' }, 500)
  }
})

/**
 * POST /api/templates/:id/use
 * Create an anonymous session from a template and generate a magic link.
 *
 * Body: { email?: string } (optional; if provided, magic link sent to email)
 */
  app.post('/:id/use', async (c) => {
  const templateId = c.req.param('id')
  const marketingKv = c.env.MARKETING_KV
  const sessionsKv = c.env.SESSIONS_KV
  const usersKv = c.env.USERS_KV

  if (!marketingKv || !sessionsKv || !usersKv) {
    return c.json({ error: 'KV not available' }, 503)
  }

  try {
    // Fetch template
    const template = await getTemplate(marketingKv, templateId)
    if (!template || template.isDiscarded) {
      return c.json({ error: 'Template not found' }, 404)
    }

    // Detect user's language from Accept-Language header or default to 'en'
    const langHeader = c.req.header('accept-language')
    const userLangStr = (langHeader?.includes('nl') ? 'nl'
      : langHeader?.includes('de') ? 'de'
      : langHeader?.includes('fr') ? 'fr'
      : 'en')
    const userLang: Lang = userLangStr as Lang

    // Create anonymous session
    const sessionId = nanoid()
    const now = Date.now()

    const session = {
      id: sessionId,
      owner_id: null, // Anonymous
      code: Math.random().toString(36).slice(-6).toUpperCase(),
      title: template.title[userLang] || template.title.en,
      status: 'draft',
      anonymity: 'full' as const,
      vote_policy: 'once' as const,
      session_mode: 'reflection' as const,
      created_at: now,
      started_at: null,
      closed_at: null,
      archived_at: null,
      team_id: null,
      is_public: 1,
      // Pre-load questions from template
      questions: template.questions.map((q, idx) => ({
        id: nanoid(),
        session_id: sessionId,
        position: idx,
        kind: q.type === 'open' ? 'open'
          : q.type === 'scale' ? 'likert'
          : 'multi_select',
        prompt: q.text[userLang] || q.text['en'],
        options: q.type === 'multiple_choice'
          ? (q.text[userLang] || q.text['en']).split('|').map((label: string) => ({
              id: nanoid(),
              label,
            }))
          : [],
        created_at: now,
      })),
    }

    // Store session in SESSIONS_KV (temporary store)
    await sessionsKv.put(`session:${sessionId}`, JSON.stringify(session), {
      expirationTtl: 3600, // 1 hour
    })

    // Generate magic link token
    const magicToken = nanoid()
    await usersKv.put(`magic_link:${magicToken}`, sessionId, {
      expirationTtl: 3600, // 1 hour
    })

    // Increment template usage
    await incrementUsageCount(marketingKv, templateId)

    const magicLink = `${c.env.PAGES_URL}/s/${sessionId}?token=${magicToken}`

    console.log({
      event: 'api.templates.use.success',
      templateId,
      sessionId,
    })

    return c.json({
      ok: true,
      data: {
        sessionId,
        magicLink,
        expiresIn: 3600,
      },
    })
  } catch (err) {
    console.log({
      event: 'api.templates.use.error',
      templateId,
      error: err instanceof Error ? err.message : String(err),
    })
    return c.json({ error: 'Failed to create session from template' }, 500)
  }
})

/**
 * POST /api/templates (internal only)
 * Store a finished template from the Cloudflare Workflow.
 * Requires webhook secret in Authorization header.
 */
  app.post('/', async (c) => {
  const kv = c.env.MARKETING_KV
  if (!kv) {
    return c.json({ error: 'MARKETING_KV not available' }, 503)
  }

  // Validate authorization (simple secret check)
  const auth = c.req.header('authorization')
  const expectedAuth = `Bearer ${c.env.JWT_SECRET}`
  if (auth !== expectedAuth) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  try {
    const template = await c.req.json()

    // Validate template structure
    if (!template.id || !template.title || !template.questions) {
      return c.json({ error: 'Invalid template structure' }, 400)
    }

    // Store template
    await kv.put(`template:${template.id}`, JSON.stringify(template))

    // Update indices (inline for simplicity; could delegate to templates-kv helper)
    const indexRaw = await kv.get('templates:index', 'json')
    const index = (indexRaw as string[] | null) || []
    if (!index.includes(template.id)) {
      index.push(template.id)
      await kv.put('templates:index', JSON.stringify(index))
    }

    console.log({
      event: 'api.templates.store.success',
      templateId: template.id,
      questions: template.questions.length,
    })

    return c.json({ ok: true, data: { id: template.id } })
  } catch (err) {
    console.log({
      event: 'api.templates.store.error',
      error: err instanceof Error ? err.message : String(err),
    })
    return c.json({ error: 'Failed to store template' }, 500)
  }
  })

  parent.route('/api/gallery', app)
}
