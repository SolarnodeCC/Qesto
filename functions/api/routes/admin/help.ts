/**
 * Help Assistant Admin Endpoints (Week 4).
 *
 * GET  /api/admin/help/review-queue     — List flagged documents pending review
 * POST /api/admin/help/prompt-versions  — Create/publish a new system prompt version
 * GET  /api/admin/help/prompt-versions  — List all prompt versions
 * GET  /api/admin/help/prompt-versions/:id — Get specific prompt version
 * POST /api/admin/help/documents/dismiss-flag — Dismiss a review queue entry
 */

import { Hono } from 'hono'
import { z } from 'zod'
import type { Env } from '../../types'
import { authMiddleware, type AuthVariables } from '../../middleware/auth'
import { adminMiddleware, type AdminVariables } from '../../middleware/admin'
import { safeLogContext , logEvent} from '../../lib/log'

type Vars = AuthVariables & AdminVariables

const PromptVersionSchema = z.object({
  content: z.string().min(1).max(10000),
  topic: z.string().optional(),
  trigger_event: z.string().default('manual_admin'),
})

const DismissReviewSchema = z.object({
  documentId: z.string().min(1),
  action: z.enum(['prompt_updated', 'doc_revised', 'dismissed']),
})

export function registerHelpAdminRoutes(app: Hono<{ Bindings: Env; Variables: Vars }>): void {
  // GET /api/admin/help/review-queue — List flagged documents
  app.get('/help/review-queue', authMiddleware, adminMiddleware, async (c) => {
    const traceId = c.get('trace_id')

    try {
      const entries = await c.env.DB.prepare(
        `SELECT
          rq.id,
          rq.document_id,
          rq.downvote_count,
          rq.period_days,
          rq.flagged_at,
          rq.reviewed_at,
          rq.reviewed_by,
          rq.action,
          hd.title,
          hd.topic,
          hd.scope,
          (SELECT COUNT(*) FROM help_feedback WHERE document_id = rq.document_id AND helpful = 0 AND created_at >= datetime('now', '-7 days')) as recent_downvotes
         FROM help_documents_review_queue rq
         JOIN help_documents hd ON rq.document_id = hd.id
         WHERE rq.reviewed_at IS NULL
         ORDER BY rq.flagged_at DESC`,
      )
        .all<{
          id: string
          document_id: string
          title: string
          topic: string
          scope: string
          downvote_count: number
          period_days: number
          flagged_at: number
          reviewed_at: number | null
          reviewed_by: string | null
          action: string | null
          recent_downvotes: number
        }>()

      return c.json(
        {
          ok: true,
          data: {
            flagged_documents: (entries.results || []).map((entry) => ({
              reviewId: entry.id,
              documentId: entry.document_id,
              title: entry.title,
              topic: entry.topic,
              scope: entry.scope,
              downvoteCount: entry.downvote_count,
              recentDownvotes: entry.recent_downvotes,
              flaggedAt: entry.flagged_at,
              reviewedAt: entry.reviewed_at,
              reviewedBy: entry.reviewed_by,
              action: entry.action,
            })),
          },
          trace_id: traceId,
        },
        200,
      )
    } catch (err) {
      safeLogContext(err, { traceId: traceId ?? 'unknown', route: c.req.path, errorClass: err instanceof Error ? err.name : 'UnknownError', statusCode: 500 })
      return c.json(
        {
          ok: false,
          error: {
            code: 'internal_error',
            message: 'Failed to fetch review queue',
          },
          trace_id: traceId,
        },
        500,
      )
    }
  })

  // POST /api/admin/help/prompt-versions — Create new system prompt version
  app.post('/help/prompt-versions', authMiddleware, adminMiddleware, async (c) => {
    const traceId = c.get('trace_id')
    const user = c.get('user')

    let body: unknown
    try {
      body = await c.req.json()
    } catch {
      return c.json(
        {
          ok: false,
          error: { code: 'bad_request', message: 'Invalid JSON' },
          trace_id: traceId,
        },
        400,
      )
    }

    const parsed = PromptVersionSchema.safeParse(body)
    if (!parsed.success) {
      return c.json(
        {
          ok: false,
          error: {
            code: 'validation_error',
            message: 'Missing or invalid fields: content (required), topic (optional), trigger_event (optional)',
          },
          trace_id: traceId,
        },
        400,
      )
    }

    try {
      const { content, topic, trigger_event } = parsed.data
      const now = Math.floor(Date.now() / 1000)

      // Get next version number
      const lastVersion = await c.env.DB.prepare(
        `SELECT MAX(version) as max_version FROM help_prompt_versions`,
      ).first<{ max_version: number | null }>()

      const nextVersion = (lastVersion?.max_version ?? 0) + 1

      const promptId = `prompt-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`

      await c.env.DB.prepare(
        `INSERT INTO help_prompt_versions
         (id, version, content, trigger_event, triggered_by, topic, active, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
      )
        .bind(promptId, nextVersion, content, trigger_event, user.sub, topic || null, now)
        .run()

      logEvent({
          event: 'help.prompt.created',
          prompt_id: promptId,
          version: nextVersion,
          topic,
          trigger_event,
          admin_user: user.sub,
        })

      return c.json(
        {
          ok: true,
          data: {
            prompt_id: promptId,
            version: nextVersion,
            content,
            topic,
            trigger_event,
            active: false,
            created_at: now,
          },
          trace_id: traceId,
        },
        201,
      )
    } catch (err) {
      safeLogContext(err, { traceId: traceId ?? 'unknown', route: c.req.path, errorClass: err instanceof Error ? err.name : 'UnknownError', statusCode: 500 })
      return c.json(
        {
          ok: false,
          error: {
            code: 'internal_error',
            message: 'Failed to create prompt version',
          },
          trace_id: traceId,
        },
        500,
      )
    }
  })

  // GET /api/admin/help/prompt-versions — List all prompt versions
  app.get('/help/prompt-versions', authMiddleware, adminMiddleware, async (c) => {
    const traceId = c.get('trace_id')

    try {
      const versions = await c.env.DB.prepare(
        `SELECT id, version, topic, trigger_event, triggered_by, active, created_at
         FROM help_prompt_versions
         ORDER BY version DESC
         LIMIT 50`,
      )
        .all<{
          id: string
          version: number
          topic: string | null
          trigger_event: string
          triggered_by: string
          active: number
          created_at: number
        }>()

      return c.json(
        {
          ok: true,
          data: {
            versions: (versions.results || []).map((v) => ({
              id: v.id,
              version: v.version,
              topic: v.topic,
              triggerEvent: v.trigger_event,
              triggeredBy: v.triggered_by,
              active: v.active === 1,
              createdAt: v.created_at,
            })),
          },
          trace_id: traceId,
        },
        200,
      )
    } catch (err) {
      safeLogContext(err, { traceId: traceId ?? 'unknown', route: c.req.path, errorClass: err instanceof Error ? err.name : 'UnknownError', statusCode: 500 })
      return c.json(
        {
          ok: false,
          error: {
            code: 'internal_error',
            message: 'Failed to fetch prompt versions',
          },
          trace_id: traceId,
        },
        500,
      )
    }
  })

  // GET /api/admin/help/prompt-versions/:id — Get specific version
  app.get('/help/prompt-versions/:id', authMiddleware, adminMiddleware, async (c) => {
    const { id } = c.req.param()
    const traceId = c.get('trace_id')

    try {
      const version = await c.env.DB.prepare(
        `SELECT id, version, content, topic, trigger_event, triggered_by, active, created_at
         FROM help_prompt_versions
         WHERE id = ?`,
      )
        .bind(id)
        .first<{
          id: string
          version: number
          content: string
          topic: string | null
          trigger_event: string
          triggered_by: string
          active: number
          created_at: number
        }>()

      if (!version) {
        return c.json(
          {
            ok: false,
            error: { code: 'not_found', message: 'Prompt version not found' },
            trace_id: traceId,
          },
          404,
        )
      }

      return c.json(
        {
          ok: true,
          data: {
            id: version.id,
            version: version.version,
            content: version.content,
            topic: version.topic,
            triggerEvent: version.trigger_event,
            triggeredBy: version.triggered_by,
            active: version.active === 1,
            createdAt: version.created_at,
          },
          trace_id: traceId,
        },
        200,
      )
    } catch (err) {
      safeLogContext(err, { traceId: traceId ?? 'unknown', route: c.req.path, errorClass: err instanceof Error ? err.name : 'UnknownError', statusCode: 500 })
      return c.json(
        {
          ok: false,
          error: {
            code: 'internal_error',
            message: 'Failed to fetch prompt version',
          },
          trace_id: traceId,
        },
        500,
      )
    }
  })

  // POST /api/admin/help/documents/dismiss-flag — Mark review as completed
  app.post('/help/documents/dismiss-flag', authMiddleware, adminMiddleware, async (c) => {
    const traceId = c.get('trace_id')
    const user = c.get('user')

    let body: unknown
    try {
      body = await c.req.json()
    } catch {
      return c.json(
        {
          ok: false,
          error: { code: 'bad_request', message: 'Invalid JSON' },
          trace_id: traceId,
        },
        400,
      )
    }

    const parsed = DismissReviewSchema.safeParse(body)
    if (!parsed.success) {
      return c.json(
        {
          ok: false,
          error: {
            code: 'validation_error',
            message: 'Missing required fields: documentId, action',
          },
          trace_id: traceId,
        },
        400,
      )
    }

    const { documentId, action } = parsed.data
    const now = Math.floor(Date.now() / 1000)

    try {
      await c.env.DB.prepare(
        `UPDATE help_documents_review_queue
         SET reviewed_at = ?, reviewed_by = ?, action = ?
         WHERE document_id = ? AND reviewed_at IS NULL`,
      )
        .bind(now, user.sub, action, documentId)
        .run()

      logEvent({
          event: 'help.feedback.review_resolved',
          document_id: documentId,
          action,
          admin_user: user.sub,
        })

      return c.json(
        {
          ok: true,
          data: { resolved_at: now },
          trace_id: traceId,
        },
        200,
      )
    } catch (err) {
      safeLogContext(err, { traceId: traceId ?? 'unknown', route: c.req.path, errorClass: err instanceof Error ? err.name : 'UnknownError', statusCode: 500 })
      return c.json(
        {
          ok: false,
          error: {
            code: 'internal_error',
            message: 'Failed to dismiss flag',
          },
          trace_id: traceId,
        },
        500,
      )
    }
  })
}
