import { Hono } from 'hono'
import type { Env } from '../../types'
import type { SessionVars } from './shared'

import { requireFound, rejectDraftForResults } from '../../lib/session-lifecycle'
import { fetchSession, fetchQuestions, getSessionRoomStub } from './shared'

export function mountResultsRoutes(app: Hono<{ Bindings: Env; Variables: SessionVars }>) {
  app.get('/:id/results', async (c) => {
    const user = c.get('user')
    const id = c.req.param('id')
    const resultsLoaded = requireFound(await fetchSession(c.env.DB, id, user.sub))
    if (!resultsLoaded.ok) {
      return c.json(
        { ok: false, error: { code: resultsLoaded.error.code, message: resultsLoaded.error.message }, trace_id: c.get('trace_id') },
        resultsLoaded.error.status,
      )
    }
    const resultsGate = rejectDraftForResults(resultsLoaded.session)
    if (!resultsGate.ok) {
      return c.json(
        { ok: false, error: { code: resultsGate.error.code, message: resultsGate.error.message }, trace_id: c.get('trace_id') },
        resultsGate.error.status,
      )
    }
    const session = resultsGate.session
    const questions = await fetchQuestions(c.env.DB, id)
    const question = questions[0] ?? null

    if (session.status === 'live') {
      // Live: pull current snapshot from the DO.
      const room = await getSessionRoomStub(c.env, id)
      const snap = await room.fetch('https://do.internal/state')
      const body = (await snap.json().catch(() => null)) as
        | { ok: true; data: { counts: Record<string, number>; voterCount: number } }
        | null
      const counts = body?.ok ? body.data.counts : {}
      const total = Object.values(counts).reduce((a, b) => a + b, 0)
      return c.json({
        ok: true,
        data: { session, question, results: { counts, total, source: 'live' as const } },
        trace_id: c.get('trace_id'),
      })
    }

    // Closed: aggregate from D1 votes table.
    const { results } = await c.env.DB
      .prepare(
        `SELECT option_id, COUNT(*) AS n
           FROM votes
          WHERE session_id = ?1
          GROUP BY option_id`,
      )
      .bind(id)
      .all<{ option_id: string; n: number }>()
    const counts: Record<string, number> = {}
    let total = 0
    for (const row of results ?? []) {
      counts[row.option_id] = row.n
      total += row.n
    }
    return c.json({
      ok: true,
      data: { session, question, results: { counts, total, source: 'persisted' as const } },
      trace_id: c.get('trace_id'),
    })
  })
}
