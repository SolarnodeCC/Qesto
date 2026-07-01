// Marketing Review Dashboard — content calendar (planned topics the Content
// Engine cron picks up). One row = one platform (LinkedIn or YouTube).

import { Hono } from 'hono'
import { z } from 'zod'
import { authMiddleware, type AuthVariables } from '../../middleware/auth'
import { marketingOwnerMiddleware, type MarketingOwnerVariables } from '../../middleware/marketing-owner'
import { validateBody } from '../../lib/request-validation'
import { recordAuditEvent } from '../../lib/audit'
import { errorResponse } from '../../lib/error-handler'
import { ulid } from '../../lib/ulid'
import type { Env } from '../../types'

type App = Hono<{ Bindings: Env; Variables: AuthVariables & MarketingOwnerVariables }>

interface CalendarRow {
  id: string
  platform: string
  topic: string
  scheduled_for: number
  status: string
  video_asset_id: string | null
  notes: string | null
  created_at: number
  updated_at: number
}

export function mountCalendarRoutes(app: App) {
  app.get('/calendar', authMiddleware, marketingOwnerMiddleware, async (c) => {
    const trace_id = c.get('trace_id')
    const status = c.req.query('status')
    const stmt = status
      ? c.env.DB.prepare(`SELECT * FROM content_calendar WHERE status = ?1 ORDER BY scheduled_for ASC`).bind(status)
      : c.env.DB.prepare(`SELECT * FROM content_calendar ORDER BY scheduled_for ASC`)
    const { results } = await stmt.all<CalendarRow>()
    return c.json({ ok: true, data: { items: results ?? [] }, trace_id }, 200)
  })

  const CreateCalendarItem = z.object({
    platform: z.enum(['linkedin', 'youtube']),
    topic: z.string().min(1).max(500),
    scheduled_for: z.number().int().positive(),
    video_asset_id: z.string().max(64).nullable().optional(),
    notes: z.string().max(2000).nullable().optional(),
  })
  app.post('/calendar', authMiddleware, marketingOwnerMiddleware, async (c) => {
    const trace_id = c.get('trace_id')
    const validated = await validateBody(c, CreateCalendarItem)
    if ('error' in validated) return validated.error
    const { platform, topic, scheduled_for, video_asset_id, notes } = validated.data
    const id = ulid()
    const now = Date.now()
    await c.env.DB.prepare(
      `INSERT INTO content_calendar (id, platform, topic, scheduled_for, status, video_asset_id, notes, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, 'planned', ?5, ?6, ?7, ?7)`,
    )
      .bind(id, platform, topic, scheduled_for, video_asset_id ?? null, notes ?? null, now)
      .run()
    await recordAuditEvent(c, { action: 'marketing.calendar_create', subject_type: 'content_calendar', subject_id: id, after_snapshot: { platform, topic, scheduled_for }, trace_id })
    return c.json({ ok: true, data: { id, status: 'planned' }, trace_id }, 201)
  })

  const PatchCalendarItem = z.object({
    topic: z.string().min(1).max(500).optional(),
    scheduled_for: z.number().int().positive().optional(),
    video_asset_id: z.string().max(64).nullable().optional(),
    notes: z.string().max(2000).nullable().optional(),
  })
  app.patch('/calendar/:id', authMiddleware, marketingOwnerMiddleware, async (c) => {
    const trace_id = c.get('trace_id')
    const id = c.req.param('id')
    const validated = await validateBody(c, PatchCalendarItem)
    if ('error' in validated) return validated.error

    const { topic, scheduled_for, video_asset_id, notes } = validated.data
    const sets: string[] = []
    const binds: unknown[] = []
    let i = 1
    if (topic !== undefined) {
      sets.push(`topic = ?${i++}`)
      binds.push(topic)
    }
    if (scheduled_for !== undefined) {
      sets.push(`scheduled_for = ?${i++}`)
      binds.push(scheduled_for)
    }
    if (video_asset_id !== undefined) {
      sets.push(`video_asset_id = ?${i++}`)
      binds.push(video_asset_id)
    }
    if (notes !== undefined) {
      sets.push(`notes = ?${i++}`)
      binds.push(notes)
    }
    if (sets.length === 0) {
      return errorResponse(c, 400, 'validation', 'No fields to update')
    }
    const now = Date.now()
    sets.push(`updated_at = ?${i++}`)
    binds.push(now)
    binds.push(id)
    const res = await c.env.DB.prepare(`UPDATE content_calendar SET ${sets.join(', ')} WHERE id = ?${i}`).bind(...binds).run()
    if ((res.meta.changes ?? 0) === 0) {
      return errorResponse(c, 404, 'not_found', 'Calendar item not found')
    }
    await recordAuditEvent(c, { action: 'marketing.calendar_update', subject_type: 'content_calendar', subject_id: id, trace_id })
    return c.json({ ok: true, data: { id, updated_at: now }, trace_id }, 200)
  })

  app.delete('/calendar/:id', authMiddleware, marketingOwnerMiddleware, async (c) => {
    const trace_id = c.get('trace_id')
    const id = c.req.param('id')
    const row = await c.env.DB.prepare(`SELECT id, status FROM content_calendar WHERE id = ?1`).bind(id).first<{ id: string; status: string }>()
    if (!row) return errorResponse(c, 404, 'not_found', 'Calendar item not found')
    if (row.status !== 'planned') {
      return errorResponse(c, 409, 'conflict', 'Only planned items can be deleted (would orphan generated content_items via cascade)')
    }
    await c.env.DB.prepare(`DELETE FROM content_calendar WHERE id = ?1`).bind(id).run()
    await recordAuditEvent(c, { action: 'marketing.calendar_delete', subject_type: 'content_calendar', subject_id: id, trace_id })
    return c.json({ ok: true, data: { id, deleted: true }, trace_id }, 200)
  })
}
