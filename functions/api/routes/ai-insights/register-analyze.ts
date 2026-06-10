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
import { getRagContext } from '../../lib/rag/getRagContext'
import type { KbSource } from '../../types/knowledge-base'
import { toInsightsInput, type SessionBundle } from '../../lib/session-bundle'
import { writeEvent } from '../../lib/observability'
import { sanitizeError } from '../../lib/error-handler'
import { safeLogContext , logEvent} from '../../lib/log'
import { fetchSessionAIGovernanceForOwner } from '../../lib/session-repository'
import { checkInsightsAllowed } from '../../lib/insights-guards'
import { featureAllowed } from '../../lib/entitlements'
import { fail, ok } from '../../lib/http'
import { writeKvJson } from '../../lib/kv'
import type { Anonymity, PlanTier } from '../../types'
import {
  AI_RATE_LIMIT,
  INSIGHTS_CACHE_TTL_SECONDS,
  INSIGHTS_MODEL,
  RAG_INSIGHTS_MAX_TOKENS,
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

      const sessionResult = await fetchSessionAIGovernanceForOwner(c.env.DB, sessionId, user.sub)

      if (!sessionResult) {
        return fail(c, 'not_found', 'Session not found or access denied', 404)
      }

      // REV-06: ZK sessions never reach AI; AI-generated sessions need consent.
      const guard = checkInsightsAllowed(sessionResult)
      if (!guard.allowed) {
        return fail(c, guard.code, guard.message, 403)
      }

      // REV-27: similar sessions are user-visible only for team sessions on a
      // plan that unlocks cross-session intelligence (Vectorize query is then
      // team-filtered — see embedAndFindSimilarSessionTitles).
      const quotas = c.get('planQuotas')
      const surfaceSimilar =
        !!sessionResult.team_id && !!quotas && featureAllowed(quotas, 'crossSessionInsights')

      const { openResponses, pollBreakdown } = await fetchInsightsVoteContext(c.env.DB, sessionId)

      const similarSessionTitles: string[] = []
      let similarSessions: { title: string; score: number }[] = []
      let sessionVector: number[] | undefined
      try {
        const embedStart = Date.now()
        const sim = await embedAndFindSimilarSessionTitles(
          { AI: c.env.AI, DECISIONS_VECTORIZE: c.env.DECISIONS_VECTORIZE },
          {
            sessionId,
            sessionTitle: sessionResult.title,
            openResponses,
            ...(surfaceSimilar ? { teamId: sessionResult.team_id } : {}),
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
        similarSessions = sim.similarSessions
      } catch (vecErr) {
        logEvent({ event: 'vectorize.query.skip', reason: (vecErr as Error).message })
      }

      // RAG grounding — best-effort. ADR-040 Phase 3.
      //   • Query: session title (most semantically dense signal we have
      //     without burning tokens on the response set).
      //   • Filter: domain='product' — insights typically map to product/UX
      //     specs. We do NOT filter by type so any spec/ADR/guide can ground.
      //   • Failure modes (timeout, embedding down, no hits) all degrade to
      //     `kbContext = ''` and the analyzer falls back to ungrounded mode.
      let kbContext = ''
      let kbSources: KbSource[] = []
      try {
        const ragStart = Date.now()
        const ragResult = await getRagContext(c.env, sessionResult.title, {
          maxTokens: RAG_INSIGHTS_MAX_TOKENS,
          domain: 'product',
        })
        kbContext = ragResult.contextBlock
        kbSources = ragResult.sources
        writeEvent(c.env.METRICS_AE, {
          name: 'ai.inference',
          userId: user.sub,
          plan: userPlan as PlanTier,
          durationMs: Date.now() - ragStart,
          traceId: trace_id,
        })
      } catch (ragErr) {
        // Includes embedding_unavailable, embedding_failed, vector_search_failed.
        // Do not surface to the caller — analyzer must still work without KB.
        logEvent({
            event: 'rag.context.skip',
            reason: (ragErr as Error).message,
          })
      }

      const bundle: SessionBundle = {
        sessionId,
        sessionTitle: sessionResult.title,
        closedAt: Date.now(),
        openResponses,
        pollBreakdown,
        similarSessionTitles,
        ...(kbContext.length > 0 ? { kbContext } : {}),
        anonymity: sessionResult.anonymity as Anonymity,
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
        // ADR-040 Phase 3: cite KB chunks that grounded the analysis. Empty
        // when RAG was unavailable or returned no hits; caller treats it as
        // optional metadata.
        kb_sources: kbSources,
        // REV-27: team-filtered similar past sessions (empty unless the
        // session belongs to a team AND the plan unlocks crossSessionInsights).
        similar_sessions: surfaceSimilar ? similarSessions : [],
      }

      await writeKvJson(c.env.DECISIONS_KV, insightsCacheKey(sessionId), payload, {
        expirationTtl: INSIGHTS_CACHE_TTL_SECONDS,
      })

      c.executionCtx.waitUntil(
        upsertInsightsSessionVector(
          { AI: c.env.AI, DECISIONS_VECTORIZE: c.env.DECISIONS_VECTORIZE },
          {
            sessionId,
            sessionTitle: sessionResult.title,
            themeCount: themes.length,
            ...(sessionVector !== undefined ? { existingVector: sessionVector } : {}),
            // ADR-0045: tag team_id/closed_at so future team-filtered
            // similarity queries can match this session.
            teamId: sessionResult.team_id,
            closedAt: sessionResult.closed_at ?? Date.now(),
          },
        ).catch((vecErr) =>
          logEvent({ event: 'vectorize.upsert.skip', reason: (vecErr as Error).message }),
        )
      )

      await recordAuditEvent(c, {
        action: 'insights.generate',
        subject_type: 'session',
        subject_id: sessionId,
        after_snapshot: {
          model: INSIGHTS_MODEL,
          theme_count: themes.length,
          user_plan: userPlan,
          anonymity: sessionResult.anonymity,
          consent_verified: true,
        },
        trace_id,
      })

      return ok(c, payload)
    } catch (err) {
      safeLogContext(err, { traceId: trace_id, route: c.req.path, errorClass: err instanceof Error ? err.name : 'UnknownError', statusCode: 500 })
      const { message } = sanitizeError(err, c.env.ENV, 500)
      return fail(c, 'internal', message, 500)
    }
  })
}
