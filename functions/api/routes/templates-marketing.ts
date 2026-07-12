// Marketing template gallery endpoints (mounted at /api/gallery) — public
// template listing/detail, "use this template" conversion, and the internal
// store/publish surface used by the generation workflow and admin review.
//
// "Use this template" (MKTP-002): the visitor leaves their email; we create a
// REAL D1 draft session (owned by their auto-created account, same semantics
// as the magic-link callback) and email a one-time sign-in link that lands on
// /sessions/{id}. The previous implementation wrote the session and token to
// KV keys nothing consumed and linked to a route that didn't exist.

import { Hono } from 'hono'
import { z } from 'zod'
import {
  getTemplate,
  listTemplates,
  incrementUsageCount,
  storeTemplate,
  setTemplatePublished,
} from '../lib/templates-kv'
import { Industry, Theme, Lang, TemplateRecord } from '../lib/template-schemas'
import type { TemplateQuestion } from '../lib/template-schemas'
import type { Env } from '../types'
import type { AuthVariables } from '../middleware/auth'
import type { PlanVariables } from '../middleware/plan'
import { logEvent } from '../lib/log'
import { ulid } from '../lib/ulid'
import { generateJoinCode } from '../lib/code'
import { generateMagicLinkToken, hashMagicLinkToken } from '../lib/tokens'
import { sendEmail, templateSessionEmail } from '../lib/email'
import { rateLimit } from '../lib/rate-limit'
import { authEmailRequestSchema } from './auth/schemas'
import { MAGIC_LINK_TTL_MS } from './auth/constants'
import { ensurePersonalTeam } from './teams'
import { pingIndexNowForTemplate } from '../lib/indexnow'

type Vars = AuthVariables & PlanVariables

const TemplatesListQuerySchema = z.object({
  industry: Industry.optional(),
  theme: Theme.optional(),
  // Forgiving on purpose (MKTP-006): the app supports locales (e.g. 'es') the
  // template pipeline doesn't. An unknown lang means "no lang filter", never a
  // 400 that blanks the gallery for that locale.
  lang: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(24),
  offset: z.coerce.number().int().min(0).default(0),
})

const USE_TEMPLATE_MAX_PER_IP = 10
const USE_TEMPLATE_MAX_PER_EMAIL = 5
const USE_TEMPLATE_WINDOW_SECONDS = 15 * 60

function detectLang(header: string | undefined): z.infer<typeof Lang> {
  const hint =
    header?.includes('nl') ? 'nl' :
    header?.includes('de') ? 'de' :
    header?.includes('fr') ? 'fr' :
    'en'
  const parsed = Lang.safeParse(hint)
  return parsed.success ? parsed.data : 'en'
}

/** Template question type → session question kind. */
function templateTypeToSessionKind(type: TemplateQuestion['type']): string {
  if (type === 'open') return 'open'
  if (type === 'scale') return 'likert'
  return 'multi_select'
}

/** Bearer check for the internal store/publish surface (workflow + admin). */
function isInternalCaller(authorization: string | undefined, env: Env): boolean {
  return !!authorization && authorization === `Bearer ${env.JWT_SECRET}`
}

export function mountMarketingTemplateRoutes(parent: Hono<{ Bindings: Env; Variables: Vars }>) {
  const app = new Hono<{ Bindings: Env; Variables: Vars }>()

  /** GET /api/gallery — list published templates with optional filters. */
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
    const langFilter = Lang.safeParse(lang)

    try {
      const { templates, total } = await listTemplates(c.env.DB, kv, {
        ...(industry ? { industry } : {}),
        ...(theme ? { theme } : {}),
        ...(langFilter.success ? { lang: langFilter.data } : {}),
        limit,
        offset,
      })
      return c.json({ ok: true, data: { templates, total, limit, offset } })
    } catch (err) {
      logEvent({ event: 'api.templates.list.error', error: err instanceof Error ? err.message : String(err) })
      return c.json({ error: 'Failed to list templates' }, 500)
    }
  })

  /** GET /api/gallery/:id — fetch one published template by ID. */
  app.get('/:id', async (c) => {
    const kv = c.env.MARKETING_KV
    if (!kv) return c.json({ error: 'MARKETING_KV not available' }, 503)

    const templateId = c.req.param('id')
    try {
      const template = await getTemplate(c.env.DB, kv, templateId)
      if (!template || template.isDiscarded || !template.isPublic) {
        return c.json({ error: 'Template not found' }, 404)
      }
      return c.json({ ok: true, data: template })
    } catch (err) {
      logEvent({ event: 'api.templates.get.error', templateId, error: err instanceof Error ? err.message : String(err) })
      return c.json({ error: 'Failed to fetch template' }, 500)
    }
  })

  /**
   * POST /api/gallery/:id/use — create a draft session from a template.
   * Body: { email }. Creates the user if needed, inserts a real D1 session +
   * questions, and emails a one-time magic link landing on /sessions/{id}.
   */
  app.post('/:id/use', async (c) => {
    const templateId = c.req.param('id')
    const kv = c.env.MARKETING_KV
    if (!kv) return c.json({ error: 'KV not available' }, 503)

    const body = (await c.req.json().catch(() => null)) as unknown
    const parsedBody = authEmailRequestSchema.safeParse(body)
    if (!parsedBody.success) {
      return c.json({ error: 'A valid email address is required' }, 400)
    }
    const email = parsedBody.data.email.toLowerCase().trim()
    const ip = c.req.header('cf-connecting-ip') ?? null

    // Same anti-abuse posture as the auth magic-link request: this endpoint
    // creates accounts and sends email.
    if (ip) {
      const ipGate = await rateLimit(c.env.ACTIONS_KV, `ip:${ip}`, {
        max: USE_TEMPLATE_MAX_PER_IP,
        windowSeconds: USE_TEMPLATE_WINDOW_SECONDS,
        prefix: 'gallery-use',
      })
      if (!ipGate.allowed) {
        return c.json({ error: 'Too many requests. Try again later.' }, 429)
      }
    }
    const emailGate = await rateLimit(c.env.ACTIONS_KV, `email:${email}`, {
      max: USE_TEMPLATE_MAX_PER_EMAIL,
      windowSeconds: USE_TEMPLATE_WINDOW_SECONDS,
      prefix: 'gallery-use',
    })
    if (!emailGate.allowed) {
      // Mirror the auth endpoint: don't leak throttling per email.
      return c.json({ ok: true, data: { sent: true } })
    }

    try {
      const template = await getTemplate(c.env.DB, kv, templateId)
      if (!template || template.isDiscarded || !template.isPublic) {
        return c.json({ error: 'Template not found' }, 404)
      }

      const userLang = detectLang(c.req.header('accept-language'))
      const now = Date.now()

      // Find-or-create the user, mirroring the magic-link callback semantics.
      const existingUser = await c.env.DB.prepare(`SELECT id FROM users WHERE email = ?1`)
        .bind(email)
        .first<{ id: string }>()
      let userId: string
      if (existingUser) {
        userId = existingUser.id
      } else {
        userId = ulid()
        await c.env.DB.prepare(
          `INSERT INTO users (id, email, created_at, last_login_at, plan) VALUES (?1, ?2, ?3, ?4, 'free')`,
        )
          .bind(userId, email, now, now)
          .run()
      }
      let teamId: string | null = null
      try {
        const personal = await ensurePersonalTeam(c.env.TEAMS_KV, c.env.DB, userId, email)
        teamId = personal.id
      } catch {
        teamId = null
      }

      // Insert the draft session; retry on the rare join-code collision.
      const sessionId = ulid()
      const title = template.title[userLang] || template.title.en
      let inserted = false
      for (let attempt = 0; attempt < 3 && !inserted; attempt++) {
        const code = generateJoinCode()
        try {
          await c.env.DB.prepare(
            `INSERT INTO sessions (id, owner_id, code, title, status, anonymity, vote_policy, session_mode, created_at, team_id)
             VALUES (?1, ?2, ?3, ?4, 'draft', 'full', 'once', 'reflection', ?5, ?6)`,
          )
            .bind(sessionId, userId, code, title, now, teamId)
            .run()
          inserted = true
        } catch (err) {
          if (attempt === 2 || !(err instanceof Error && err.message.includes('UNIQUE'))) throw err
        }
      }

      for (let idx = 0; idx < template.questions.length; idx++) {
        const q = template.questions[idx]
        const options = (q.options ?? []).map((opt) => ({
          id: opt.id,
          label: opt.label[userLang] || opt.label.en || '',
        }))
        await c.env.DB.prepare(
          `INSERT INTO questions (id, session_id, position, kind, prompt, options_json, created_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
        )
          .bind(
            ulid(),
            sessionId,
            idx,
            templateTypeToSessionKind(q.type),
            q.text[userLang] || q.text.en,
            JSON.stringify(options),
            now,
          )
          .run()
      }

      // One-time sign-in link that lands on the new session (D1-backed, same
      // consume path as regular auth — the old KV magic_link:{token} entries
      // were never read by anything).
      const rawToken = generateMagicLinkToken()
      const tokenHash = await hashMagicLinkToken(rawToken)
      await c.env.DB.prepare(
        `INSERT INTO magic_links (token_hash, email, created_at, expires_at, requester_ip)
         VALUES (?1, ?2, ?3, ?4, ?5)`,
      )
        .bind(tokenHash, email, now, now + MAGIC_LINK_TTL_MS, ip)
        .run()

      const { subject, text, html } = templateSessionEmail(
        c.env.API_URL,
        rawToken,
        `/sessions/${sessionId}`,
        template.title.en,
      )
      await sendEmail(c.env.RESEND_API_KEY, {
        to: email,
        subject,
        text,
        html,
        ...(c.env.RESEND_FROM ? { from: c.env.RESEND_FROM } : {}),
      })

      await incrementUsageCount(c.env.DB, templateId)

      logEvent({ event: 'api.templates.use.success', templateId, sessionId })
      return c.json({ ok: true, data: { sent: true } })
    } catch (err) {
      logEvent({ event: 'api.templates.use.error', templateId, error: err instanceof Error ? err.message : String(err) })
      return c.json({ error: 'Failed to create session from template' }, 500)
    }
  })

  /** POST /api/gallery — internal: store a finished template from workflow. */
  app.post('/', async (c) => {
    const kv = c.env.MARKETING_KV
    if (!kv) return c.json({ error: 'MARKETING_KV not available' }, 503)
    if (!isInternalCaller(c.req.header('authorization'), c.env)) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const raw = await c.req.json().catch(() => null)
    const parsed = TemplateRecord.safeParse(raw)
    if (!parsed.success) return c.json({ error: 'Invalid template structure' }, 400)

    try {
      const result = await storeTemplate(c.env.DB, kv, parsed.data)
      if (!result.stored) {
        return c.json({ error: 'Duplicate template (content hash already registered)' }, 409)
      }
      logEvent({ event: 'api.templates.store.success', templateId: parsed.data.id, questions: parsed.data.questions.length })
      return c.json({ ok: true, data: { id: parsed.data.id } })
    } catch (err) {
      logEvent({ event: 'api.templates.store.error', error: err instanceof Error ? err.message : String(err) })
      return c.json({ error: 'Failed to store template' }, 500)
    }
  })

  /**
   * POST /api/gallery/:id/publish — internal: flip a reviewed draft to public
   * and announce it via IndexNow (MKTP-009: drafts are never pinged).
   */
  app.post('/:id/publish', async (c) => {
    const kv = c.env.MARKETING_KV
    if (!kv) return c.json({ error: 'MARKETING_KV not available' }, 503)
    if (!isInternalCaller(c.req.header('authorization'), c.env)) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const templateId = c.req.param('id')
    try {
      const record = await setTemplatePublished(c.env.DB, kv, templateId, true)
      if (!record) return c.json({ error: 'Template not found' }, 404)
      try {
        await pingIndexNowForTemplate(c.env, templateId)
      } catch (err) {
        logEvent({ event: 'api.templates.publish.indexnow_error', templateId, error: err instanceof Error ? err.message : String(err) })
      }
      logEvent({ event: 'api.templates.publish.success', templateId })
      return c.json({ ok: true, data: { id: templateId, isPublic: true } })
    } catch (err) {
      logEvent({ event: 'api.templates.publish.error', templateId, error: err instanceof Error ? err.message : String(err) })
      return c.json({ error: 'Failed to publish template' }, 500)
    }
  })

  parent.route('/api/gallery', app)
}
