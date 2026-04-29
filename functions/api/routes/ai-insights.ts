// AI-Powered Insights — theme summarization (Phase 9 Step 6)
//
// Routes (mounted under /api):
//   POST   /sessions/:sessionId/insights/analyze   — Generate AI insights (plan-gated)
//   GET    /sessions/:sessionId/insights           — Retrieve cached insights
//
// Handoff boundary: the POST handler assembles a SessionBundle (typed, deterministic)
// from D1/Vectorize, then passes it through toInsightsInput() before the AI call.
// Output is validated by Zod inside extractThemes() — no regex parsing.

import { Hono } from 'hono'
import { authMiddleware, type AuthVariables } from '../middleware/auth'
import { recordAuditEvent } from '../lib/audit'
import { rateLimit } from '../lib/rate-limit'
import {
  extractThemes,
  InsightsAIError,
  InsightsValidationError,
} from '../lib/ai-insights'
import {
  toInsightsInput,
  type SessionBundle,
  type QuestionBreakdown,
  type PollOptionBreakdown,
} from '../lib/session-bundle'
import { writeEvent } from '../lib/observability'
import type { Env, PlanTier } from '../types'

type Vars = AuthVariables

const INSIGHTS_MODEL = '@cf/mistral/mistral-7b-instruct-v0.2'
const AI_RATE_LIMIT = { max: 10, windowSeconds: 3600, prefix: 'ai-insights' }
const CACHE_KEY = (sessionId: string) => `insights:${sessionId}`

export function mountAIInsightsRoutes(parent: any) {
  const app = new Hono<{ Bindings: Env; Variables: Vars }>()
  app.use('*', authMiddleware)

  // POST /sessions/:sessionId/insights/analyze
  app.post('/sessions/:sessionId/insights/analyze', async (c) => {
    const trace_id = c.get('trace_id')
    const sessionId = c.req.param('sessionId')
    const user = c.get('user')

    try {
      const rl = await rateLimit(c.env.ACTIONS_KV, user.sub, AI_RATE_LIMIT)
      if (!rl.allowed) {
        return c.json(
          {
            ok: false,
            error: { code: 'rate_limited', message: 'Too many insights requests; try again later' },
            trace_id,
          },
          429,
        )
      }

      const userResult = await c.env.DB.prepare(`SELECT plan FROM users WHERE id = ?1`)
        .bind(user.sub)
        .first<{ plan: string }>()

      const userPlan = userResult?.plan ?? 'free'
      if (!['starter', 'team'].includes(userPlan)) {
        return c.json(
          {
            ok: false,
            error: { code: 'forbidden', message: 'AI Insights requires starter or team plan' },
            trace_id,
          },
          403,
        )
      }

      const sessionResult = await c.env.DB.prepare(
        `SELECT id, title FROM sessions WHERE id = ?1 AND owner_id = ?2`,
      )
        .bind(sessionId, user.sub)
        .first<{ id: string; title: string }>()

      if (!sessionResult) {
        return c.json(
          { ok: false, error: { code: 'not_found', message: 'Session not found or access denied' }, trace_id },
          404,
        )
      }

      // ── Deterministic data collection ─────────────────────────────────────
      // Everything below is pure D1/Vectorize reads — no AI involved yet.

      // Open-ended free-text responses
      const openRows = await c.env.DB.prepare(
        `SELECT v.option_id AS text
           FROM votes v
           JOIN questions q ON q.id = v.question_id
          WHERE v.session_id = ?1 AND q.kind = 'open'
          ORDER BY v.submitted_at ASC
          LIMIT 500`,
      )
        .bind(sessionId)
        .all<{ text: string }>()
      const openResponses = (openRows.results ?? []).map((r) => r.text).filter(Boolean)

      // Poll/ranking/consent question breakdowns with full vote counts
      const qRows = await c.env.DB.prepare(
        `SELECT id, prompt, kind, options_json
           FROM questions
          WHERE session_id = ?1
            AND kind IN ('poll', 'ranking', 'consent')
          ORDER BY position`,
      )
        .bind(sessionId)
        .all<{ id: string; prompt: string; kind: string; options_json: string }>()

      const pollBreakdown: QuestionBreakdown[] = []
      for (const q of qRows.results ?? []) {
        const voteRows = await c.env.DB.prepare(
          `SELECT option_id, COUNT(*) AS votes
             FROM votes
            WHERE question_id = ?1
            GROUP BY option_id`,
        )
          .bind(q.id)
          .all<{ option_id: string; votes: number }>()

        let options: { id: string; label: string }[] = []
        try {
          options = JSON.parse(q.options_json) as { id: string; label: string }[]
        } catch {
          options = []
        }

        const optionBreakdowns: PollOptionBreakdown[] = options.map((o) => ({
          label: o.label,
          votes: voteRows.results?.find((v) => v.option_id === o.id)?.votes ?? 0,
        }))

        pollBreakdown.push({
          questionId: q.id,
          prompt: q.prompt,
          kind: q.kind as QuestionBreakdown['kind'],
          options: optionBreakdowns,
        })
      }

      // Vectorize: embed session context to find semantically similar past sessions.
      // Best-effort — insights still generate if Vectorize is unavailable.
      const similarSessionTitles: string[] = []
      let sessionVector: number[] | undefined
      try {
        const embedText = `${sessionResult.title}: ${openResponses.slice(0, 10).join('. ')}`
        const embedStart = Date.now()
        const embedResult = (await c.env.AI.run('@cf/baai/bge-m3', {
          text: embedText,
        })) as { data: number[][] }
        writeEvent(c.env.METRICS_AE, {
          name: 'ai.inference',
          userId: user.sub,
          plan: userPlan as PlanTier,
          durationMs: Date.now() - embedStart,
          traceId: trace_id,
        })
        const vector = embedResult?.data?.[0]
        if (vector?.length === 768) {
          sessionVector = vector
          const queryResult = await c.env.DECISIONS_VECTORIZE.query(vector, {
            topK: 3,
            returnMetadata: 'all',
          })
          const matches = queryResult.matches.filter(
            (m) => m.id !== sessionId && (m.score ?? 0) > 0.75,
          )
          for (const match of matches) {
            const meta = match.metadata as Record<string, string> | undefined
            if (meta?.title) similarSessionTitles.push(meta.title)
          }
        }
      } catch (vecErr) {
        console.log(
          JSON.stringify({ event: 'vectorize.query.skip', reason: (vecErr as Error).message }),
        )
      }

      // ── Handoff boundary ──────────────────────────────────────────────────
      // All deterministic data is now collected. Build the typed DTO and pass
      // it through toInsightsInput() before the AI call.

      const bundle: SessionBundle = {
        sessionId,
        sessionTitle: sessionResult.title,
        closedAt: Date.now(),
        openResponses,
        pollBreakdown,
        similarSessionTitles,
      }

      const insightsInput = toInsightsInput(bundle)

      // ── AI call (probabilistic layer) ─────────────────────────────────────
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
          return c.json(
            {
              ok: false,
              error: {
                code: 'ai_output_invalid',
                message: 'AI returned output that failed schema validation',
                details: err.details,
              },
              trace_id,
            },
            502,
          )
        }
        if (err instanceof InsightsAIError) {
          return c.json(
            { ok: false, error: { code: 'ai_failed', message: err.message }, trace_id },
            500,
          )
        }
        throw err
      }

      // Map InsightTheme[] → string[] to maintain frontend wire format.
      const themes = result.themes.map((t) => t.theme)

      // ── Deterministic post-processing ─────────────────────────────────────

      const payload = {
        session_id: sessionId,
        generated_at: Date.now(),
        model: INSIGHTS_MODEL,
        themes,
        follow_ups: [] as string[], // superseded by structured theme extraction
      }

      await c.env.DECISIONS_KV.put(CACHE_KEY(sessionId), JSON.stringify(payload), {
        expirationTtl: 3600,
      })

      // Vectorize upsert: store this session for future similarity queries.
      try {
        let vector: number[] | undefined = sessionVector
        if (!vector) {
          const upsertEmbedStart = Date.now()
          const upsertEmbedResult = (await c.env.AI.run('@cf/baai/bge-m3', { text: sessionResult.title })) as { data: number[][] }
          writeEvent(c.env.METRICS_AE, {
            name: 'ai.inference',
            userId: user.sub,
            plan: userPlan as PlanTier,
            durationMs: Date.now() - upsertEmbedStart,
            traceId: trace_id,
          })
          vector = upsertEmbedResult?.data?.[0]
        }
        if (vector?.length === 768) {
          await c.env.DECISIONS_VECTORIZE.upsert([
            {
              id: sessionId,
              values: vector,
              metadata: {
                session_id: sessionId,
                title: sessionResult.title,
                ts: String(Date.now()),
                theme_count: String(themes.length),
              },
            },
          ])
        }
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

      return c.json({ ok: true, data: payload, trace_id }, 200)
    } catch (err) {
      console.error('[ai-insights] analyze failed:', err)
      return c.json(
        { ok: false, error: { code: 'internal', message: (err as Error).message }, trace_id },
        500,
      )
    }
  })

  // GET /sessions/:sessionId/insights
  app.get('/sessions/:sessionId/insights', async (c) => {
    const trace_id = c.get('trace_id')
    const sessionId = c.req.param('sessionId')
    const user = c.get('user')

    try {
      const sessionCheck = await c.env.DB.prepare(
        `SELECT id FROM sessions WHERE id = ?1 AND owner_id = ?2`,
      )
        .bind(sessionId, user.sub)
        .first()

      if (!sessionCheck) {
        return c.json(
          { ok: false, error: { code: 'not_found', message: 'Session not found or access denied' }, trace_id },
          404,
        )
      }

      const cached = await c.env.DECISIONS_KV.get(CACHE_KEY(sessionId), 'json')

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
      return c.json(
        { ok: false, error: { code: 'internal', message: (err as Error).message }, trace_id },
        500,
      )
    }
  })

  parent.route('/api', app)
}
