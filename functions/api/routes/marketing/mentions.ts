// Marketing Review Dashboard — brand mentions feed (LinkedIn/Reddit/YouTube,
// collected by the Mention Monitor cron). Read + mark-reviewed only.

import { Hono } from 'hono'
import { z } from 'zod'
import { authMiddleware, type AuthVariables } from '../../middleware/auth'
import { marketingOwnerMiddleware, type MarketingOwnerVariables } from '../../middleware/marketing-owner'
import { validateBody } from '../../lib/request-validation'
import { recordAuditEvent } from '../../lib/audit'
import type { Env } from '../../types'

type App = Hono<{ Bindings: Env; Variables: AuthVariables & MarketingOwnerVariables }>

interface MentionRow {
  id: string
  platform: string
  source_id: string
  author: string | null
  body: string
  url: string | null
  reviewed: number
  fetched_at: number
  posted_at: number | null
  created_at: number
}

export function mountMentionsRoutes(app: App) {
  app.get('/mentions', authMiddleware, marketingOwnerMiddleware, async (c) => {
    const trace_id = c.get('trace_id')
    const platform = c.req.query('platform')
    const reviewedParam = c.req.query('reviewed')
    const limit = Math.min(Math.max(Number(c.req.query('limit') ?? 50), 1), 200)

    const clauses: string[] = []
    const binds: unknown[] = []
    let i = 1
    if (platform) {
      clauses.push(`platform = ?${i++}`)
      binds.push(platform)
    }
    if (reviewedParam === 'true' || reviewedParam === 'false') {
      clauses.push(`reviewed = ?${i++}`)
      binds.push(reviewedParam === 'true' ? 1 : 0)
    }
    const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : ''
    binds.push(limit)

    const { results } = await c.env.DB.prepare(
      `SELECT * FROM mentions ${where} ORDER BY fetched_at DESC LIMIT ?${i}`,
    )
      .bind(...binds)
      .all<MentionRow>()

    return c.json({ ok: true, data: { mentions: results ?? [] }, trace_id }, 200)
  })

  const PatchMention = z.object({ reviewed: z.boolean() })
  app.patch('/mentions/:id', authMiddleware, marketingOwnerMiddleware, async (c) => {
    const trace_id = c.get('trace_id')
    const id = c.req.param('id')
    const validated = await validateBody(c, PatchMention)
    if ('error' in validated) return validated.error

    const res = await c.env.DB.prepare(`UPDATE mentions SET reviewed = ?1 WHERE id = ?2`)
      .bind(validated.data.reviewed ? 1 : 0, id)
      .run()
    if ((res.meta.changes ?? 0) === 0) {
      return c.json({ ok: false, error: { code: 'not_found', message: 'Mention not found' }, trace_id }, 404)
    }
    await recordAuditEvent(c, { action: 'marketing.mention_reviewed', subject_type: 'mention', subject_id: id, after_snapshot: { reviewed: validated.data.reviewed }, trace_id })
    return c.json({ ok: true, data: { id, reviewed: validated.data.reviewed }, trace_id }, 200)
  })
}
