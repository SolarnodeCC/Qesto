// AI-Powered Insights — theme summarization + follow-ups (Phase 9 Step 6)
//
// Routes (mounted under /api):
//   POST   /sessions/:sessionId/insights/analyze   — Generate AI insights (plan-gated)
//   GET    /sessions/:sessionId/insights           — Retrieve cached insights

import { Hono } from 'hono'
import { authMiddleware, type AuthVariables } from '../middleware/auth'
import { recordAuditEvent } from '../lib/audit'
import { rateLimit } from '../lib/rate-limit'
import { writeEvent } from '../lib/observability'
import type { Env, PlanTier } from '../types'

type Vars = AuthVariables

interface InsightConfig {
  max_tokens: number
  model: string
}

const insightConfig: InsightConfig = {
  max_tokens: 500,
  model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
}

const AI_RATE_LIMIT = { max: 10, windowSeconds: 3600, prefix: 'ai-insights' }

export function mountAIInsightsRoutes(parent: any) {
  const app = new Hono<{ Bindings: Env; Variables: Vars }>()
  app.use('*', authMiddleware)

  // POST /sessions/:sessionId/insights/analyze
  app.post('/sessions/:sessionId/insights/analyze', async (c) => {
    const trace_id = c.get('trace_id')
    const sessionId = c.req.param('sessionId')
    const user = c.get('user')

    try {
      // Per-user rate limit to bound AI quota consumption.
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

      // Check plan gating (Pro/Enterprise only)
      const userResult = await (c.env.DB.prepare as any)(
        `SELECT plan FROM users WHERE id = ?1`
      )
        .bind(user.sub)
        .first()

      const userPlan = userResult?.plan ?? 'free'
      const allowedPlans = ['starter', 'team']

      if (!allowedPlans.includes(userPlan)) {
        return c.json(
          {
            ok: false,
            error: {
              code: 'forbidden',
              message: `AI Insights requires ${allowedPlans.join(' or ')} plan`
            },
            trace_id
          },
          403
        )
      }

      // Fetch session and verify ownership
      const sessionResult = await (c.env.DB.prepare as any)(
        `SELECT id, title FROM sessions WHERE id = ?1 AND owner_id = ?2`
      )
        .bind(sessionId, user.sub)
        .first()

      if (!sessionResult) {
        return c.json(
          { ok: false, error: { code: 'not_found', message: 'Session not found or access denied' }, trace_id },
          404
        )
      }

      // Fetch questions and votes for context
      const questionsResult = await (c.env.DB.prepare as any)(
        `SELECT id, prompt, options_json FROM questions WHERE session_id = ?1 ORDER BY position`
      )
        .bind(sessionId)
        .all()

      const questions = questionsResult.results ?? []

      // Build context for AI
      let context = `Session: ${sessionResult.title}\n\n`
      context += `Questions and Responses:\n`

      for (const question of questions) {
        context += `Q: ${question.prompt}\n`

        // Get vote breakdown
        const votesResult = await (c.env.DB.prepare as any)(
          `SELECT option_id, COUNT(*) as count FROM votes WHERE question_id = ?1 GROUP BY option_id`
        )
          .bind(question.id)
          .all()

        const votes = votesResult.results ?? []
        let options: any[] = []
        try {
          options = JSON.parse(question.options_json || '[]')
        } catch (parseErr) {
          console.warn(`[ai-insights] failed to parse options for question ${question.id}:`, parseErr)
        }

        for (const vote of votes) {
          const option = options.find((o: any) => o.id === vote.option_id)
          context += `  • ${option?.label || vote.option_id}: ${vote.count} votes\n`
        }
      }

      // Vectorize: embed current session context to find similar past sessions.
      // Best-effort — insights still generate if Vectorize is unavailable.
      let similarSessionsContext = ''
      try {
        const aiStart = Date.now()
        const embedResult = await c.env.AI.run('@cf/baai/bge-m3', { text: context }) as { data: number[][] }
        writeEvent(c.env.METRICS_AE, {
          name: 'ai.inference',
          userId: user.sub,
          plan: userPlan as PlanTier,
          durationMs: Date.now() - aiStart,
          traceId: trace_id,
        })
        const vector = embedResult?.data?.[0]
        if (vector?.length === 768) {
          const queryResult = await c.env.DECISIONS_VECTORIZE.query(vector, {
            topK: 3,
            returnMetadata: 'all',
          })
          const matches = queryResult.matches.filter(m => m.id !== sessionId && (m.score ?? 0) > 0.75)
          if (matches.length > 0) {
            similarSessionsContext = '\n\nSimilar past sessions for additional context:\n'
            for (const match of matches) {
              const meta = match.metadata as Record<string, string> | undefined
              if (meta?.title) similarSessionsContext += `- "${meta.title}"\n`
            }
          }
          // Store vector for upsert after generation (reuse to save a second embed call).
          ;(c as any).__sessionVector = vector
        }
      } catch (vecErr) {
        console.log(JSON.stringify({ event: 'vectorize.query.skip', reason: (vecErr as Error).message }))
      }

      // Call Workers AI for theme summarization
      const aiPrompt = `Analyze the following session results and provide:
1. Key themes and patterns in participant responses
2. Top 3 actionable insights
3. Follow-up questions for deeper engagement

${context}${similarSessionsContext}
Keep response concise (max 150 words). Focus on actionable insights.`

      const approxInputChars = aiPrompt.length
      const t0 = Date.now()
      let aiResponse: unknown
      try {
        aiResponse = await c.env.AI.run(insightConfig.model, {
          messages: [{ role: 'user', content: aiPrompt }],
          max_tokens: insightConfig.max_tokens,
        })
        const aiLatency = Date.now() - t0
        console.log(JSON.stringify({ event: 'ai.analyze.ok', model: insightConfig.model, latencyMs: aiLatency, approxInputChars }))
        writeEvent(c.env.METRICS_AE, {
          name: 'ai.inference',
          userId: user.sub,
          plan: userPlan as PlanTier,
          durationMs: aiLatency,
          traceId: trace_id,
        })
      } catch (aiErr) {
        console.log(JSON.stringify({ event: 'ai.analyze.error', model: insightConfig.model, latencyMs: Date.now() - t0, approxInputChars, error: aiErr instanceof Error ? aiErr.message : String(aiErr) }))
        throw aiErr
      }

      const insightText = (aiResponse as any)?.response ?? 'No insights generated'

      // Parse AI response to extract themes and follow-ups
      const themes = extractThemes(insightText)
      const followUps = extractFollowUps(insightText)

      // Store insights in KV cache (1-hour TTL)
      const cacheKey = `insights:${sessionId}`
      const insights = {
        session_id: sessionId,
        generated_at: Date.now(),
        model: insightConfig.model,
        themes,
        follow_ups: followUps,
        raw_analysis: insightText
      }

      await c.env.DECISIONS_KV.put(cacheKey, JSON.stringify(insights), {
        expirationTtl: 3600
      })

      // Vectorize: upsert this session's insights so future sessions can find it.
      // Re-uses the vector computed above; falls back to a fresh embed if missing.
      try {
        let vector: number[] | undefined = (c as any).__sessionVector
        if (!vector) {
          const aiStart = Date.now()
          const embedResult = await c.env.AI.run('@cf/baai/bge-m3', { text: insightText }) as { data: number[][] }
          writeEvent(c.env.METRICS_AE, {
            name: 'ai.inference',
            userId: user.sub,
            plan: userPlan as PlanTier,
            durationMs: Date.now() - aiStart,
            traceId: trace_id,
          })
          vector = embedResult?.data?.[0]
        }
        if (vector?.length === 768) {
          await c.env.DECISIONS_VECTORIZE.upsert([{
            id: sessionId,
            values: vector,
            metadata: {
              session_id: sessionId,
              title: sessionResult.title as string,
              ts: String(Date.now()),
              theme_count: String(themes.length),
            },
          }])
        }
      } catch (vecErr) {
        console.log(JSON.stringify({ event: 'vectorize.upsert.skip', reason: (vecErr as Error).message }))
      }

      // Audit trail (log prompt + model + response for compliance)
      await recordAuditEvent(c, {
        action: 'insights.generate',
        subject_type: 'session',
        subject_id: sessionId,
        after_snapshot: {
          model: insightConfig.model,
          theme_count: themes.length,
          follow_up_count: followUps.length,
          user_plan: userPlan
        },
        trace_id
      })

      return c.json(
        {
          ok: true,
          data: {
            session_id: sessionId,
            themes,
            follow_ups: followUps,
            generated_at: Date.now(),
            model: insightConfig.model
          },
          trace_id
        },
        200
      )
    } catch (err) {
      console.error('[ai-insights] analyze failed:', err)
      return c.json(
        { ok: false, error: { code: 'internal', message: (err as Error).message }, trace_id },
        500
      )
    }
  })

  // GET /sessions/:sessionId/insights
  app.get('/sessions/:sessionId/insights', async (c) => {
    const trace_id = c.get('trace_id')
    const sessionId = c.req.param('sessionId')
    const user = c.get('user')

    try {
      // Verify session ownership before returning insights
      const sessionCheck = await (c.env.DB.prepare as any)(
        `SELECT id FROM sessions WHERE id = ?1 AND owner_id = ?2`
      )
        .bind(sessionId, user.sub)
        .first()

      if (!sessionCheck) {
        return c.json(
          { ok: false, error: { code: 'not_found', message: 'Session not found or access denied' }, trace_id },
          404
        )
      }

      const cacheKey = `insights:${sessionId}`
      const cached = await c.env.DECISIONS_KV.get(cacheKey, 'json')

      if (!cached) {
        return c.json(
          {
            ok: true,
            data: {
              session_id: sessionId,
              insights: null,
              message: 'No insights generated yet. Call POST /sessions/:id/insights/analyze first.'
            },
            trace_id
          },
          200
        )
      }

      return c.json(
        {
          ok: true,
          data: cached,
          trace_id
        },
        200
      )
    } catch (err) {
      console.error('[ai-insights] get failed:', err)
      return c.json(
        { ok: false, error: { code: 'internal', message: (err as Error).message }, trace_id },
        500
      )
    }
  })

  parent.route('/api', app)
}

// ─── Insight Extraction Helpers ────────────────────────────────────────────

function extractThemes(text: string): string[] {
  // Parse themes from AI response (looks for numbered lists or bullet points)
  const lines = text.split('\n')
  const themes: string[] = []

  for (const line of lines) {
    const match = line.match(/^[•\-\d.]\s*(.+)/)
    if (match && match[1] && match[1].length > 10) {
      themes.push(match[1].trim())
    }
  }

  return themes.slice(0, 5) // limit to top 5 themes
}

function extractFollowUps(text: string): string[] {
  // Extract follow-up questions (lines containing question marks)
  const lines = text.split('\n')
  const followUps: string[] = []

  for (const line of lines) {
    if (line.includes('?') && line.length > 10) {
      const cleaned = line.replace(/^[•\-\d.]\s*/, '').trim()
      if (cleaned.endsWith('?')) {
        followUps.push(cleaned)
      }
    }
  }

  return followUps.slice(0, 3) // limit to top 3 follow-ups
}
