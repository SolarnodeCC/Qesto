import { sanitizeError } from '../../lib/error-handler'
import { safeLogContext } from '../../lib/log'
import { fail, ok } from '../../lib/http'
import { readKvJson } from '../../lib/kv'
import { sessionOwnedBy } from '../../lib/session-repository'
import { insightsCacheKey } from './constants'
import type { AiInsightsApp } from './types'

export function registerInsightsGetRoute(app: AiInsightsApp): void {
  app.get('/sessions/:sessionId/insights', async (c) => {
    const sessionId = c.req.param('sessionId')
    const user = c.get('user')

    try {
      const owned = await sessionOwnedBy(c.env.DB, sessionId, user.sub)

      if (!owned) {
        return fail(c, 'not_found', 'Session not found or access denied', 404)
      }

      const cached = await readKvJson<unknown>(c.env.DECISIONS_KV, insightsCacheKey(sessionId))

      if (!cached) {
        return ok(c, {
          session_id: sessionId,
          insights: null,
          message: 'No insights generated yet. Call POST /sessions/:id/insights/analyze first.',
        })
      }

      return ok(c, cached)
    } catch (err) {
      safeLogContext(err, { traceId: c.get('trace_id') ?? 'unknown', route: c.req.path, errorClass: err instanceof Error ? err.name : 'UnknownError', statusCode: 500 })
      const { message } = sanitizeError(err, c.env.ENV, 500)
      return fail(c, 'internal', message, 500)
    }
  })
}
