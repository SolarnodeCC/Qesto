/**
 * Help Assistant Feedback Endpoint (Week 2).
 * POST /api/help/feedback — Submit helpful/unhelpful feedback on answers.
 */

import { Hono } from 'hono'
import { z } from 'zod'
import type { Env } from '../../types'
import { verifyJwt } from '../../lib/jwt'
import type { AuthVariables } from '../../middleware/auth'
import { safeLogContext , logEvent} from '../../lib/log'

const FeedbackSchema = z.object({
  documentId: z.string().min(1),
  helpful: z.boolean(),
  feedbackText: z.string().max(500).optional(),
})

export function registerHelpFeedbackRoute(app: Hono<{ Bindings: Env; Variables: AuthVariables }>): void {
  app.post('/help/feedback', async (c) => {
    const traceId = c.get('trace_id') ?? crypto.randomUUID()

    // Auth is optional — anonymous users can submit feedback
    let userId: string | null = null
    const authHeader = c.req.header('authorization')
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7)
      const claims = await verifyJwt(token, c.env.JWT_SECRET)
      if (claims) userId = claims.sub
    }

    // Parse and validate input
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

    const parsed = FeedbackSchema.safeParse(body)
    if (!parsed.success) {
      return c.json(
        {
          ok: false,
          error: {
            code: 'validation_error',
            message: 'Missing required fields: documentId, helpful',
          },
          trace_id: traceId,
        },
        400,
      )
    }

    const { documentId, helpful, feedbackText } = parsed.data

    try {
      // Store feedback in D1
      const feedbackId = `feedback-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
      const now = Math.floor(Date.now() / 1000)

      await c.env.DB.prepare(
        `INSERT INTO help_feedback (id, user_id, document_id, question, answer, helpful, feedback_text, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
        .bind(feedbackId, userId ?? 'anonymous', documentId, '', '', helpful ? 1 : 0, feedbackText || null, now)
        .run()

      // Check if document should be flagged for review (auto-tune trigger)
      const sevenDaysAgo = Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000)
      const downvotes = await c.env.DB.prepare(
        `SELECT COUNT(*) as count FROM help_feedback
         WHERE document_id = ? AND helpful = 0 AND created_at >= ?`,
      )
        .bind(documentId, sevenDaysAgo)
        .first<{ count: number }>()

      const downvoteCount = downvotes?.count || 0

      // If 3+ downvotes in 7 days, flag for review
      if (downvoteCount >= 3) {
        const reviewId = `review-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
        await c.env.DB.prepare(
          `INSERT OR REPLACE INTO help_documents_review_queue
           (id, document_id, downvote_count, period_days, flagged_at)
           VALUES (?, ?, ?, 7, ?)`,
        )
          .bind(reviewId, documentId, downvoteCount, now)
          .run()

        logEvent({
            event: 'help.feedback.auto_tune_flagged',
            document_id: documentId,
            downvote_count: downvoteCount,
          })
      }

      // Log event
      logEvent({
          event: 'help.feedback.ok',
          user_id: userId ?? 'anonymous',
          document_id: documentId,
          helpful,
          downvote_count: downvoteCount,
        })

      return c.json(
        {
          ok: true,
          data: { feedback_id: feedbackId },
          trace_id: traceId,
        },
        200,
      )
    } catch (err) {
      safeLogContext(err, { traceId: traceId, route: c.req.path, errorClass: err instanceof Error ? err.name : 'UnknownError', statusCode: 500 })

      return c.json(
        {
          ok: false,
          error: {
            code: 'internal_error',
            message: 'Failed to store feedback',
          },
          trace_id: traceId,
        },
        500,
      )
    }
  })
}
