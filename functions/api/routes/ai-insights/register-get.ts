import { sanitizeError } from '../../lib/error-handler'
import { sessionOwnedBy } from '../../lib/session-repository'
import { insightsCacheKey } from './constants'
import type { AiInsightsApp } from './types'

export function registerInsightsGetRoute(app: AiInsightsApp): void {
  app.get('/sessions/:sessionId/insights', async (c) => {
    const trace_id = c.get('trace_id')
    const sessionId = c.req.param('sessionId')
    const user = c.get('user')

    try {
      const owned = await sessionOwnedBy(c.env.DB, sessionId, user.sub)

      if (!owned) {
        return c.json(
          { ok: false, error: { code: 'not_found', message: 'Session not found or access denied' }, trace_id },
          404,
        )
      }

      const cached = await c.env.DECISIONS_KV.get(insightsCacheKey(sessionId), 'json')

      if (!cached) {
        return c.json(
          {
            ok: true,
            data: {
              session_id: sessionId,
              insights: null,
              message: 'No insights generated yet. Call POST /sessions/:id/insights/analyze first.',
            },
            trace_id,
          },
          200,
        )
      }

      return c.json({ ok: true, data: cached, trace_id }, 200)
    } catch (err) {
      console.error('[ai-insights] get failed:', err)
      const { message } = sanitizeError(err, c.env.ENV, 500)
      return c.json(
        { ok: false, error: { code: 'internal', message }, trace_id },
        500,
      )
    }
  })
}
