import { requireFeature } from '../../middleware/feature-gate'
import { recordAuditEvent } from '../../lib/audit'
import { rateLimit } from '../../lib/rate-limit'
import {
  extractThemes,
  InsightsAIError,
  InsightsValidationError,
} from '../../lib/ai-insights'
import { fetchInsightsVoteContext } from '../../lib/insights-analyze-data'
import {
  embedAndFindSimilarSessionTitles,
  upsertInsightsSessionVector,
} from '../../lib/insights-vectorize'
import { toInsightsInput, type SessionBundle } from '../../lib/session-bundle'
import { writeEvent } from '../../lib/observability'
import { sanitizeError } from '../../lib/error-handler'
import { fetchSessionTitleForOwner } from '../../lib/session-repository'
import { fail, ok } from '../../lib/http'
import { writeKvJson } from '../../lib/kv'
import type { PlanTier } from '../../types'
import {
  AI_RATE_LIMIT,
  INSIGHTS_CACHE_TTL_SECONDS,
  INSIGHTS_MODEL,
  insightsCacheKey,
} from './constants'
import type { AiInsightsApp } from './types'

export function registerInsightsAnalyzeRoute(app: AiInsightsApp): void {
  app.post('/sessions/:sessionId/insights/analyze', requireFeature('insightsAI'), async (c) => {
    const trace_id = c.get('trace_id')
    const sessionId = c.req.param('sessionId')
    const user = c.get('user')
    const userPlan = c.get('plan')

    try {
      const rl = await rateLimit(c.env.ACTIONS_KV, user.sub, AI_RATE_LIMIT)
      if (!rl.allowed) {
        return fail(c, 'rate_limited', 'Too many insights requests; try again later', 429, {
          reset_at: rl.resetAt,
          limit: AI_RATE_LIMIT.max,
        })
      }

      const sessionResult = await fetchSessionTitleForOwner(c.env.DB, sessionId, user.sub)

      if (!sessionResult) {
        return fail(c, 'not_found', 'Session not found or access denied', 404)
      }

      const { openResponses, pollBreakdown } = await fetchInsightsVoteContext(c.env.DB, sessionId)

      const similarSessionTitles: string[] = []
      let sessionVector: number[] | undefined
      try {
        const embedStart = Date.now()
        const sim = await embedAndFindSimilarSessionTitles(
          { AI: c.env.AI, DECISIONS_VECTORIZE: c.env.DECISIONS_VECTORIZE },
          {
            sessionId,
            sessionTitle: sessionResult.title,
            openResponses,
          },
        )
        writeEvent(c.env.METRICS_AE, {
          name: 'ai.inference',
          userId: user.sub,
          plan: userPlan as PlanTier,
          durationMs: Date.now() - embedStart,
          traceId: trace_id,
        })
        sessionVector = sim.vector
        similarSessionTitles.push(...sim.similarSessionTitles)
      } catch (vecErr) {
        console.log(
          JSON.stringify({ event: 'vectorize.query.skip', reason: (vecErr as Error).message }),
        )
      }

      const bundle: SessionBundle = {
        sessionId,
        sessionTitle: sessionResult.title,
        closedAt: Date.now(),
        openResponses,
        pollBreakdown,
        similarSessionTitles,
      }

      const insightsInput = toInsightsInput(bundle)

      let result: Awaited<ReturnType<typeof extractThemes>>
      try {
        const inferenceStart = Date.now()
        result = await extractThemes(c.env.AI, insightsInput, INSIGHTS_MODEL)
        writeEvent(c.env.METRICS_AE, {
          name: 'ai.inference',
          userId: user.sub,
          plan: userPlan as PlanTier,
          durationMs: Date.now() - inferenceStart,
          traceId: trace_id,
        })
      } catch (err) {
        if (err instanceof InsightsValidationError) {
          return fail(
            c,
            'ai_output_invalid',
            'AI returned output that failed schema validation',
            502,
            err.details,
          )
        }
        if (err instanceof InsightsAIError) {
          return fail(c, 'ai_failed', err.message, 500)
        }
        throw err
      }

      const themes = result.themes.map((t) => t.theme)

      const payload = {
        session_id: sessionId,
        generated_at: Date.now(),
        model: INSIGHTS_MODEL,
        themes,
        follow_ups: [] as string[],
      }

      await writeKvJson(c.env.DECISIONS_KV, insightsCacheKey(sessionId), payload, {
        expirationTtl: INSIGHTS_CACHE_TTL_SECONDS,
      })

      try {
        await upsertInsightsSessionVector(
          { AI: c.env.AI, DECISIONS_VECTORIZE: c.env.DECISIONS_VECTORIZE },
          {
            sessionId,
            sessionTitle: sessionResult.title,
            themeCount: themes.length,
            ...(sessionVector !== undefined ? { existingVector: sessionVector } : {}),
          },
        )
      } catch (vecErr) {
        console.log(
          JSON.stringify({ event: 'vectorize.upsert.skip', reason: (vecErr as Error).message }),
        )
      }

      await recordAuditEvent(c, {
        action: 'insights.generate',
        subject_type: 'session',
        subject_id: sessionId,
        after_snapshot: {
          model: INSIGHTS_MODEL,
          theme_count: themes.length,
          user_plan: userPlan,
        },
        trace_id,
      })

      return ok(c, payload)
    } catch (err) {
      console.error('[ai-insights] analyze failed:', err)
      const { message } = sanitizeError(err, c.env.ENV, 500)
      return fail(c, 'internal', message, 500)
    }
  })
}
