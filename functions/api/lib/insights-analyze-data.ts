/**
 * Deterministic D1 reads for POST /sessions/:id/insights/analyze (WS3).
 * No AI / Vectorize — keeps the route thin and testable at the boundary.
 */

import type { QuestionBreakdown } from './session-bundle'
import { validateData, PollOptionArraySchema } from './validators'

export async function fetchInsightsVoteContext(
  db: D1Database,
  sessionId: string,
): Promise<{ openResponses: string[]; pollBreakdown: QuestionBreakdown[] }> {
  const openRows = await db
    .prepare(
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

  const qRows = await db
    .prepare(
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
    const voteRows = await db
      .prepare(
        `SELECT option_id, COUNT(*) AS votes
           FROM votes
          WHERE question_id = ?1
          GROUP BY option_id`,
      )
      .bind(q.id)
      .all<{ option_id: string; votes: number }>()

    let options: { id: string; label: string }[] = []
    try {
      options = validateData(JSON.parse(q.options_json), PollOptionArraySchema) ?? []
    } catch {
      options = []
    }

    const optionBreakdowns = options.map((o) => ({
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

  return { openResponses, pollBreakdown }
}
