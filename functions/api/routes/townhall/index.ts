import { Hono } from 'hono'
import { z } from 'zod'
import { authMiddleware, type AuthVariables } from '../../middleware/auth'
import { planMiddleware, type PlanVariables } from '../../middleware/plan'
import type { Env } from '../../types'
import { featureAllowed, denyFeature } from '../../lib/entitlements'
import { fetchSession } from '../sessions/shared'
import { requireFound, requireDraft } from '../../lib/session-lifecycle'
import { recordAuditEvent } from '../../lib/audit'
import type { ParentApp } from '../parent-app'
import { ensureTownhallSchema } from '../../lib/session-schema-repair'
import { sanitizeError } from '../../lib/error-handler'

type Vars = AuthVariables & PlanVariables

const ConfigSchema = z.object({
  moderation: z.enum(['pre', 'post']),
  anonymity: z.enum(['full', 'partial', 'none', 'zero_knowledge']).optional(),
})

/**
 * TOWNHALL (ADR-0044) draft-time setup. The live board itself runs over the
 * SessionRoom WebSocket; this REST surface only configures the session while it
 * is still in DRAFT. Team-tier only.
 */
export function registerTownhallConfigRoutes(app: Hono<{ Bindings: Env; Variables: Vars }>): void {
  app.get('/sessions/:id/townhall/config', async (c) => {
    const trace_id = c.get('trace_id')
    const user = c.get('user')
    const loaded = requireFound(await fetchSession(c.env.DB, c.req.param('id'), user.sub))
    if (!loaded.ok) {
      return c.json({ ok: false, error: { code: loaded.error.code, message: loaded.error.message }, trace_id }, loaded.error.status)
    }
    const s = loaded.session
    return c.json({
      ok: true,
      data: {
        sessionMode: s.session_mode,
        moderation: s.townhall_moderation ?? null,
        anonymity: s.anonymity,
      },
      trace_id,
    })
  })

  app.post('/sessions/:id/townhall/config', async (c) => {
    const trace_id = c.get('trace_id')
    const user = c.get('user')
    const id = c.req.param('id')

    if (!featureAllowed(c.get('planQuotas'), 'townhallQA')) {
      return c.json({ ok: false, error: denyFeature(c.get('plan'), 'townhallQA'), trace_id }, 403)
    }

    const parsed = ConfigSchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) {
      return c.json({ ok: false, error: { code: 'validation', message: 'Invalid townhall config' }, trace_id }, 400)
    }
    const { moderation, anonymity } = parsed.data

    const loaded = requireFound(await fetchSession(c.env.DB, id, user.sub))
    if (!loaded.ok) {
      return c.json({ ok: false, error: { code: loaded.error.code, message: loaded.error.message }, trace_id }, loaded.error.status)
    }
    const draft = requireDraft(loaded.session, 'townhall_config')
    if (!draft.ok) {
      return c.json({ ok: false, error: { code: draft.error.code, message: draft.error.message }, trace_id }, draft.error.status)
    }

    const sets = ['townhall_moderation = ?2', "session_mode = 'townhall'"]
    const binds: unknown[] = [id, moderation]
    if (anonymity) {
      sets.push('anonymity = ?3')
      binds.push(anonymity)
    }
    try {
      await c.env.DB.prepare(`UPDATE sessions SET ${sets.join(', ')} WHERE id = ?1`).bind(...binds).run()
    } catch (err) {
      const sanitized = sanitizeError(err, c.env.ENV, 503)
      return c.json({ ok: false, error: { code: 'schema_error', message: sanitized.message }, trace_id }, 503)
    }

    await recordAuditEvent(c, {
      action: 'townhall.config',
      subject_type: 'session',
      subject_id: id,
      after_snapshot: { moderation, ...(anonymity ? { anonymity } : {}) },
      trace_id,
    })

    return c.json({
      ok: true,
      data: { sessionMode: 'townhall', moderation, ...(anonymity ? { anonymity } : {}) },
      trace_id,
    })
  })
}

type TownhallQuestionRow = {
  id: string
  body: string
  display_name: string | null
  status: string
  upvotes: number
  group_parent: string | null
  was_spotlit: number
  created_at: number
  resolved_at: number | null
}

const CSV_COLUMNS = [
  'question_id',
  'body',
  'display_name',
  'status',
  'upvotes',
  'grouped_count',
  'was_spotlit',
  'created_at',
  'resolved_at',
] as const

function csvCell(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/**
 * TOWNHALL (ADR-0044) data retention: export the persisted board (post-close) and
 * GDPR removal. The live board lives in the DO; these read/write the D1 archive tier
 * populated on session close. author_hash is never exported (anonymity).
 */
export function registerTownhallDataRoutes(app: Hono<{ Bindings: Env; Variables: Vars }>): void {
  app.get('/sessions/:id/townhall/export', async (c) => {
    const trace_id = c.get('trace_id')
    const user = c.get('user')
    const id = c.req.param('id')
    const quotas = c.get('planQuotas')
    if (!featureAllowed(quotas, 'townhallQA')) {
      return c.json({ ok: false, error: denyFeature(c.get('plan'), 'townhallQA'), trace_id }, 403)
    }
    if (!featureAllowed(quotas, 'resultsExport')) {
      return c.json({ ok: false, error: denyFeature(c.get('plan'), 'resultsExport'), trace_id }, 403)
    }
    const loaded = requireFound(await fetchSession(c.env.DB, id, user.sub))
    if (!loaded.ok) {
      return c.json({ ok: false, error: { code: loaded.error.code, message: loaded.error.message }, trace_id }, loaded.error.status)
    }

    const { results } = await c.env.DB
      .prepare(
        `SELECT id, body, display_name, status, upvotes, group_parent, was_spotlit, created_at, resolved_at
           FROM townhall_questions WHERE session_id = ?1 ORDER BY created_at ASC`,
      )
      .bind(id)
      .all<TownhallQuestionRow>()
    const rows = results ?? []
    const groupedCount: Record<string, number> = {}
    for (const r of rows) if (r.group_parent) groupedCount[r.group_parent] = (groupedCount[r.group_parent] ?? 0) + 1

    const format = c.req.query('format') === 'csv' ? 'csv' : 'json'
    if (format === 'json') {
      return c.json({
        ok: true,
        data: {
          questions: rows.map((r) => ({
            id: r.id,
            body: r.body,
            displayName: r.display_name,
            status: r.status,
            upvotes: r.upvotes,
            groupedCount: groupedCount[r.id] ?? 0,
            wasSpotlit: r.was_spotlit === 1,
            createdAt: r.created_at,
            resolvedAt: r.resolved_at,
          })),
        },
        trace_id,
      })
    }
    const lines = [CSV_COLUMNS.join(',')]
    for (const r of rows) {
      lines.push(
        [
          r.id,
          r.body,
          r.display_name,
          r.status,
          r.upvotes,
          groupedCount[r.id] ?? 0,
          r.was_spotlit,
          r.created_at,
          r.resolved_at,
        ]
          .map(csvCell)
          .join(','),
      )
    }
    return new Response(lines.join('\n'), {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="townhall-${id}.csv"`,
      },
    })
  })

  app.delete('/sessions/:id/townhall/questions/:itemId', async (c) => {
    const trace_id = c.get('trace_id')
    const user = c.get('user')
    const id = c.req.param('id')
    const itemId = c.req.param('itemId')
    if (!featureAllowed(c.get('planQuotas'), 'townhallQA')) {
      return c.json({ ok: false, error: denyFeature(c.get('plan'), 'townhallQA'), trace_id }, 403)
    }
    const loaded = requireFound(await fetchSession(c.env.DB, id, user.sub))
    if (!loaded.ok) {
      return c.json({ ok: false, error: { code: loaded.error.code, message: loaded.error.message }, trace_id }, loaded.error.status)
    }
    const res = await c.env.DB
      .prepare(`DELETE FROM townhall_questions WHERE id = ?1 AND session_id = ?2`)
      .bind(itemId, id)
      .run()
    if ((res.meta?.changes ?? 0) === 0) {
      return c.json({ ok: false, error: { code: 'not_found', message: 'Question not found' }, trace_id }, 404)
    }
    await recordAuditEvent(c, {
      action: 'townhall.question.delete',
      subject_type: 'townhall_question',
      subject_id: itemId,
      trace_id,
    })
    return c.json({ ok: true, data: { deleted: true }, trace_id })
  })
}

export function mountTownhallRoutes(parent: ParentApp): void {
  const app = new Hono<{ Bindings: Env; Variables: Vars }>()
  app.use('*', authMiddleware)
  app.use('*', planMiddleware)
  app.use('*', async (c, next) => {
    await ensureTownhallSchema(c.env.DB)
    await next()
  })
  registerTownhallConfigRoutes(app)
  registerTownhallDataRoutes(app)
  parent.route('/api', app)
}
