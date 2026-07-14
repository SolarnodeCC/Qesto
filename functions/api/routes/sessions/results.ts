import { Hono } from 'hono'
import { errorResponse } from '../../lib/error-handler'
import type { Env } from '../../types'
import type { Question } from '../../types'
import type { SessionVars } from './shared'

import { requireFound, rejectDraftForResults } from '../../lib/session-lifecycle'
import { fetchSession, fetchQuestions, loadSessionVoteMap, getSessionRoomStub } from './shared'

// One question's recap slice: the question plus its own vote tally.
type QuestionResult = {
  id: string
  kind: Question['kind']
  prompt: string
  options: Question['options']
  counts: Record<string, number>
  total: number
}

// Build a per-question results array from the session's persisted vote map.
// For open/word_cloud questions the `option_id` column holds the response text,
// so `counts` is keyed by response and works directly with the word-cloud UI.
function buildQuestionResults(
  questions: Question[],
  voteMap: Map<string, Map<string, number>>,
): QuestionResult[] {
  return questions.map((q) => {
    const inner = voteMap.get(q.id)
    const counts: Record<string, number> = {}
    let total = 0
    if (inner) {
      for (const [optionId, n] of inner) {
        counts[optionId] = n
        total += n
      }
    }
    return { id: q.id, kind: q.kind, prompt: q.prompt, options: q.options, counts, total }
  })
}

export function mountResultsRoutes(app: Hono<{ Bindings: Env; Variables: SessionVars }>) {
  app.get('/:id/results', async (c) => {
    const user = c.get('user')
    const id = c.req.param('id')
    const resultsLoaded = requireFound(await fetchSession(c.env.DB, id, user.sub))
    if (!resultsLoaded.ok) {
      return errorResponse(c, resultsLoaded.error.status, resultsLoaded.error.code, resultsLoaded.error.message)
    }
    const resultsGate = rejectDraftForResults(resultsLoaded.session)
    if (!resultsGate.ok) {
      return errorResponse(c, resultsGate.error.status, resultsGate.error.code, resultsGate.error.message)
    }
    const session = resultsGate.session
    const questions = await fetchQuestions(c.env.DB, id)

    // Persisted votes flush to D1 during the live session too, so the vote map
    // is the base for every question in both live and closed states.
    const voteMap = await loadSessionVoteMap(c.env.DB, id)
    const questionResults = buildQuestionResults(questions, voteMap)

    if (session.status === 'live') {
      // Live: overlay the DO snapshot onto the currently-active question so its
      // tally reflects in-flight votes not yet flushed to D1.
      const room = await getSessionRoomStub(c.env, id)
      const snap = await room.fetch('https://do.internal/state')
      const body = (await snap.json().catch(() => null)) as
        | { ok: true; data: { question: { id: string } | null; counts: Record<string, number> } }
        | null
      if (body?.ok && body.data.question) {
        const activeId = body.data.question.id
        const active = questionResults.find((q) => q.id === activeId)
        if (active) {
          active.counts = body.data.counts
          active.total = Object.values(body.data.counts).reduce((a, b) => a + b, 0)
        }
      }
      return c.json({
        ok: true,
        data: { session, questions: questionResults, source: 'live' as const },
        trace_id: c.get('trace_id'),
      })
    }

    // Closed/archived: per-question aggregates straight from D1 votes.
    return c.json({
      ok: true,
      data: { session, questions: questionResults, source: 'persisted' as const },
      trace_id: c.get('trace_id'),
    })
  })
}
