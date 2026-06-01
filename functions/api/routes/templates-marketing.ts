// Marketing templates endpoints — public template gallery and session creation from templates.

import { Hono } from 'hono'
import { z } from 'zod'
import { nanoid } from 'nanoid'
import {
  getTemplate,
  listTemplates,
  incrementUsageCount,
  storeTemplate,
} from '../lib/templates-kv'
import { Industry, Theme, Lang, TemplateRecord } from '../lib/template-schemas'
import type { Env } from '../types'
import type { AuthVariables } from '../middleware/auth'
import type { PlanVariables } from '../middleware/plan'
import { MARKETING_MAGIC_LINK_TTL_SECONDS } from '../lib/constants'
import { logEvent } from '../lib/log'

type Vars = AuthVariables & PlanVariables

const TemplatesListQuerySchema = z.object({
  industry: Industry.optional(),
  theme: Theme.optional(),
  lang: Lang.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
})

function detectLang(header: string | undefined): z.infer<typeof Lang> {
  const hint =
    header?.includes('nl') ? 'nl' :
    header?.includes('de') ? 'de' :
    header?.includes('fr') ? 'fr' :
    'en'
  const parsed = Lang.safeParse(hint)
  return parsed.success ? parsed.data : 'en'
}

export function mountMarketingTemplateRoutes(parent: Hono<{ Bindings: Env; Variables: Vars }>) {
  const app = new Hono<{ Bindings: Env; Variables: Vars }>()

  /** GET /api/templates — list all public templates with optional filters. */
  app.get('/', async (c) => {
    const kv = c.env.MARKETING_KV
    if (!kv) return c.json({ error: 'MARKETING_KV not available' }, 503)

    const parsed = TemplatesListQuerySchema.safeParse({
      industry: c.req.query('industry') ?? undefined,
      theme: c.req.query('theme') ?? undefined,
      lang: c.req.query('lang') ?? undefined,
      limit: c.req.query('limit') ?? undefined,
      offset: c.req.query('offset') ?? undefined,
    })
    if (!parsed.success) {
      return c.json({ error: 'Invalid query params' }, 400)
    }
    const { industry, theme, lang, limit, offset } = parsed.data

    try {
      const templates = await listTemplates(kv, { ...(industry ? { industry } : {}), ...(theme ? { theme } : {}), ...(lang ? { lang } : {}) })
      templates.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      const paginated = templates.slice(offset, offset + limit)
      return c.json({ ok: true, data: paginated, pagination: { limit, offset, total: templates.length } })
    } catch (err) {
      logEvent({ event: 'api.templates.list.error', error: err instanceof Error ? err.message : String(err) })
      return c.json({ error: 'Failed to list templates' }, 500)
    }
  })

  /** GET /api/templates/:id — fetch one template by ID. */
  app.get('/:id', async (c) => {
    const kv = c.env.MARKETING_KV
    if (!kv) return c.json({ error: 'MARKETING_KV not available' }, 503)

    const templateId = c.req.param('id')
    try {
      const template = await getTemplate(kv, templateId)
      if (!template || template.isDiscarded) return c.json({ error: 'Template not found' }, 404)
      return c.json({ ok: true, data: template })
    } catch (err) {
      logEvent({ event: 'api.templates.get.error', templateId, error: err instanceof Error ? err.message : String(err) })
      return c.json({ error: 'Failed to fetch template' }, 500)
    }
  })

  /** POST /api/templates/:id/use — create an anonymous draft session from a template. */
  app.post('/:id/use', async (c) => {
    const templateId = c.req.param('id')
    const marketingKv = c.env.MARKETING_KV
    const sessionsKv = c.env.SESSIONS_KV
    const usersKv = c.env.USERS_KV
    if (!marketingKv || !sessionsKv || !usersKv) return c.json({ error: 'KV not available' }, 503)

    try {
      const template = await getTemplate(marketingKv, templateId)
      if (!template || template.isDiscarded) return c.json({ error: 'Template not found' }, 404)

      const userLang = detectLang(c.req.header('accept-language'))
      const sessionId = nanoid()
      const now = Date.now()
      const code = Math.random().toString(36).slice(-6).toUpperCase()

      const session = {
        id: sessionId,
        owner_id: null,
        code,
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
        questions: template.questions.map((q, idx) => ({
          id: nanoid(),
          session_id: sessionId,
          position: idx,
          kind: q.type === 'open' ? 'open' : q.type === 'scale' ? 'likert' : 'multi_select',
          prompt: q.text[userLang] || q.text.en,
          options: q.type === 'multiple_choice'
            ? (q.text[userLang] || q.text.en).split('|').map((label: string) => ({ id: nanoid(), label }))
            : [],
          created_at: now,
        })),
      }

      await sessionsKv.put(`session:${sessionId}`, JSON.stringify(session), { expirationTtl: MARKETING_MAGIC_LINK_TTL_SECONDS })
      const magicToken = nanoid()
      await usersKv.put(`magic_link:${magicToken}`, sessionId, { expirationTtl: MARKETING_MAGIC_LINK_TTL_SECONDS })
      await incrementUsageCount(marketingKv, templateId)

      const magicLink = `${c.env.PAGES_URL}/s/${sessionId}?token=${magicToken}`
      logEvent({ event: 'api.templates.use.success', templateId, sessionId })
      return c.json({ ok: true, data: { sessionId, magicLink, expiresIn: 3600 } })
    } catch (err) {
      logEvent({ event: 'api.templates.use.error', templateId, error: err instanceof Error ? err.message : String(err) })
      return c.json({ error: 'Failed to create session from template' }, 500)
    }
  })

  /** POST /api/templates — internal: store a finished template from workflow. */
  app.post('/', async (c) => {
    const kv = c.env.MARKETING_KV
    if (!kv) return c.json({ error: 'MARKETING_KV not available' }, 503)

    const auth = c.req.header('authorization')
    const expectedAuth = `Bearer ${c.env.JWT_SECRET}`
    if (auth !== expectedAuth) return c.json({ error: 'Unauthorized' }, 401)

    const raw = await c.req.json().catch(() => null)
    const parsed = TemplateRecord.safeParse(raw)
    if (!parsed.success) return c.json({ error: 'Invalid template structure' }, 400)

    try {
      await storeTemplate(kv, parsed.data)
      logEvent({ event: 'api.templates.store.success', templateId: parsed.data.id, questions: parsed.data.questions.length })
      return c.json({ ok: true, data: { id: parsed.data.id } })
    } catch (err) {
      logEvent({ event: 'api.templates.store.error', error: err instanceof Error ? err.message : String(err) })
      return c.json({ error: 'Failed to store template' }, 500)
    }
  })

  parent.route('/api/gallery', app)
}
