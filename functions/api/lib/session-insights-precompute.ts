import { ulid } from './ulid'
import { writeEvent } from './observability'
import { readKvText, writeKvJson } from './kv'
import { validateKvJson, PollOptionArraySchema } from './protocol-schemas'
import { extractThemes, type InsightTheme } from './ai-insights'
import { upsertInsightsSessionVector } from './insights-vectorize'
import { upsertInsightsDaily } from './team-insights'
import { toInsightsInput, type SessionBundle, type QuestionBreakdown } from './session-bundle'
import type { Env, PlanTier } from '../types'
import { INSIGHTS_SHARED_CACHE_TTL_SECONDS } from './constants'
import { CachedThemeLabelsSchema, parseJsonString } from './boundary-decode'
import { logEvent } from './log'

/** Extract theme labels from a cached precompute/analyze payload (`{ themes: string[] }`). */
function parseCachedThemeLabels(raw: string): string[] | null {
  const parsed = parseJsonString(CachedThemeLabelsSchema, raw)
  return parsed?.themes ?? null
}

/** Best-effort background insight generation triggered on session close. */
export async function precomputeInsights(
  env: Env,
  sessionId: string,
  sessionTitle: string,
  ownerId: string,
  opts: {
    anonymity?: string | null
    teamId?: string | null
    plan?: PlanTier | undefined
    traceId?: string | undefined
  } = {},
): Promise<void> {
  const MODEL = '@cf/mistral/mistral-7b-instruct-v0.2'
  const cacheKey = `insights:${sessionId}`

  if (opts.anonymity === 'zero_knowledge') {
    logEvent({ event: 'insights.precompute.zk_skip', sessionId })
    return
  }

  const userRow = await env.DB.prepare(`SELECT plan FROM users WHERE id = ?1`)
    .bind(ownerId)
    .first<{ plan: string }>()
  if (userRow?.plan !== 'team') return

  const openRows = await env.DB.prepare(
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

  const qRows = await env.DB.prepare(
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
    const voteRows = await env.DB.prepare(
      `SELECT option_id, COUNT(*) AS votes FROM votes WHERE question_id = ?1 GROUP BY option_id`,
    )
      .bind(q.id)
      .all<{ option_id: string; votes: number }>()

    const options = validateKvJson(q.options_json, PollOptionArraySchema) ?? []

    pollBreakdown.push({
      questionId: q.id,
      prompt: q.prompt,
      kind: q.kind as QuestionBreakdown['kind'],
      options: options.map((o) => ({
        label: o.label,
        votes: voteRows.results?.find((v) => v.option_id === o.id)?.votes ?? 0,
      })),
    })
  }

  const bundle: SessionBundle = {
    sessionId,
    sessionTitle,
    closedAt: Date.now(),
    openResponses,
    pollBreakdown,
    similarSessionTitles: [],
  }

  const input = toInsightsInput(bundle)
  if (input.openResponses.length === 0 && !input.pollBreakdown?.length) return

  let themes: InsightTheme[]
  const cached = await readKvText(env.DECISIONS_KV, cacheKey)
  const cachedLabels = cached ? parseCachedThemeLabels(cached) : null
  if (cachedLabels && cachedLabels.length > 0) {
    themes = cachedLabels.map((theme) => ({ theme, count: 0, examples: [] }))
  } else {
    const result = await extractThemes(env.AI, input, MODEL)
    themes = result.themes
    const payload = {
      session_id: sessionId,
      generated_at: Date.now(),
      model: MODEL,
      themes: themes.map((t) => t.theme),
      follow_ups: [] as string[],
    }
    await writeKvJson(env.DECISIONS_KV, cacheKey, payload, { expirationTtl: INSIGHTS_SHARED_CACHE_TTL_SECONDS })
  }

  const nVotes =
    openResponses.length +
    pollBreakdown.reduce((sum, q) => sum + q.options.reduce((s, o) => s + o.votes, 0), 0)
  const confidence = themes.length > 0 ? Math.min(1, Math.round((nVotes / 25) * 100) / 100) : 0

  let embeddingRef = false
  try {
    embeddingRef = await upsertInsightsSessionVector(
      { AI: env.AI, DECISIONS_VECTORIZE: env.DECISIONS_VECTORIZE },
      {
        sessionId,
        sessionTitle,
        themeCount: themes.length,
        teamId: opts.teamId ?? null,
        closedAt: bundle.closedAt,
      },
    )
  } catch (vecErr) {
    logEvent({ event: 'insights.precompute.vectorize_skip', sessionId, error: String(vecErr) })
  }

  await upsertInsightsDaily(env.DB, {
    id: ulid(),
    session_id: sessionId,
    team_id: opts.teamId ?? null,
    day: new Date(bundle.closedAt).toISOString().slice(0, 10),
    themes_json: JSON.stringify(themes),
    confidence,
    n_votes: nVotes,
    embedding_ref: embeddingRef,
    computed_at: Date.now(),
  })

  writeEvent(env.METRICS_AE, {
    name: 'insight.aggregated',
    sessionId,
    teamId: opts.teamId ?? undefined,
    plan: opts.plan,
    count: themes.length,
    value: confidence,
    traceId: opts.traceId,
  })

  logEvent({ event: 'insights.precompute.ok', sessionId, theme_count: themes.length, embedding_ref: embeddingRef })
}
