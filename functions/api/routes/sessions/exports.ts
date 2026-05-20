// EXPORT-RICH-01-A + EXPORT-PDF-01 — Rich session exports (Team plan only).
//
// Routes (all require team plan + owner + closed/archived session):
//   GET /api/sessions/:id/export.json — structured JSON with questions, options, vote counts
//   GET /api/sessions/:id/export.csv  — enhanced CSV with question text, response labels, vote %
//   GET /api/sessions/:id/export.html — print-ready signed HTML export (EXPORT-PDF-01)

import { Hono } from 'hono'
import { requireFound } from '../../lib/session-lifecycle'
import { generateSessionHtmlExport } from '../../lib/export-pdf'
import type { Env } from '../../types'
import type { Session } from '../../types'
import type { AuthVariables } from '../../middleware/auth'
import type { PlanVariables } from '../../middleware/plan'

type Vars = AuthVariables & PlanVariables

type FetchSession = (db: D1Database, id: string, ownerId: string) => Promise<Session | null>

async function loadExportVoteMap(
  db: D1Database,
  sessionId: string,
): Promise<Map<string, Map<string, number>>> {
  const { results } = await db
    .prepare(
      `SELECT question_id, option_id, COUNT(*) AS count
         FROM votes
        WHERE session_id = ?1
     GROUP BY question_id, option_id`,
    )
    .bind(sessionId)
    .all<{ question_id: string; option_id: string; count: number }>()
  const map = new Map<string, Map<string, number>>()
  for (const row of results ?? []) {
    let inner = map.get(row.question_id)
    if (!inner) {
      inner = new Map<string, number>()
      map.set(row.question_id, inner)
    }
    inner.set(row.option_id, row.count)
  }
  return map
}

function parseQuestionOptions(rawJson: string | null): { id: string; label: string }[] {
  try {
    const parsed = JSON.parse(rawJson ?? '[]')
    if (Array.isArray(parsed)) return parsed as { id: string; label: string }[]
  } catch {
    // Malformed options_json — treat as open-answer with no options.
  }
  return []
}

export function mountExportRoutes(
  app: Hono<{ Bindings: Env; Variables: Vars }>,
  fetchSession: FetchSession,
) {
  // GET /api/sessions/:id/export.json — structured JSON export (team plan)
  app.get('/:id/export.json', async (c) => {
    const traceId = c.get('trace_id')
    if (c.get('plan') !== 'team') {
      return c.json(
        {
          ok: false,
          error: { code: 'upgrade_required', message: 'Rich export requires the Team plan' },
          trace_id: traceId,
        },
        403,
      )
    }
    const user = c.get('user')
    const id = c.req.param('id')
    const loaded = requireFound(await fetchSession(c.env.DB, id, user.sub))
    if (!loaded.ok) {
      return c.json(
        { ok: false, error: { code: loaded.error.code, message: loaded.error.message }, trace_id: traceId },
        loaded.error.status,
      )
    }
    const session = loaded.session
    if (session.status !== 'closed' && session.status !== 'archived') {
      return c.json(
        {
          ok: false,
          error: { code: 'session_not_closed', message: 'Session must be closed to export' },
          trace_id: traceId,
        },
        409,
      )
    }

    const { results: questionRows } = await c.env.DB
      .prepare(
        `SELECT id, position, kind, prompt, options_json
           FROM questions
          WHERE session_id = ?1
       ORDER BY position ASC`,
      )
      .bind(id)
      .all<{ id: string; position: number; kind: string; prompt: string; options_json: string | null }>()

    const voteMap = await loadExportVoteMap(c.env.DB, id)

    const questionsExport = (questionRows ?? []).map((q) => {
      const options = parseQuestionOptions(q.options_json)
      const qVotes = voteMap.get(q.id) ?? new Map<string, number>()
      const optionsWithVotes = options.map((o) => ({
        id: o.id,
        label: o.label,
        votes: qVotes.get(o.id) ?? 0,
      }))
      const totalVotes = optionsWithVotes.reduce((s, o) => s + o.votes, 0)
      return {
        id: q.id,
        position: q.position,
        kind: q.kind,
        prompt: q.prompt,
        options: optionsWithVotes,
        total_votes: totalVotes,
      }
    })

    const totalVotes = questionsExport.reduce((s, q) => s + q.total_votes, 0)
    const startedAt = session.started_at ?? null
    const closedAt = session.closed_at ?? null
    const durationMs = startedAt !== null && closedAt !== null ? closedAt - startedAt : null

    const exportPayload = {
      export_version: '1',
      exported_at: Date.now(),
      id: session.id,
      title: session.title,
      status: session.status,
      anonymity: session.anonymity,
      team_id: session.team_id ?? null,
      created_at: session.created_at,
      started_at: startedAt,
      closed_at: closedAt,
      duration_ms: durationMs,
      questions: questionsExport,
      total_votes: totalVotes,
    }

    return new Response(JSON.stringify(exportPayload, null, 2), {
      headers: {
        'content-type': 'application/json',
        'content-disposition': `attachment; filename="session-${id}.json"`,
        'cache-control': 'private, no-store',
      },
    })
  })

  // GET /api/sessions/:id/export.csv — enhanced CSV export (team plan).
  // Supersedes the previous starter-tier "Question,Option,Votes" CSV.
  app.get('/:id/export.csv', async (c) => {
    const traceId = c.get('trace_id')
    if (c.get('plan') !== 'team') {
      return c.json(
        {
          ok: false,
          error: { code: 'upgrade_required', message: 'Rich export requires the Team plan' },
          trace_id: traceId,
        },
        403,
      )
    }
    const user = c.get('user')
    const id = c.req.param('id')
    const loaded = requireFound(await fetchSession(c.env.DB, id, user.sub))
    if (!loaded.ok) {
      return c.json(
        { ok: false, error: { code: loaded.error.code, message: loaded.error.message }, trace_id: traceId },
        loaded.error.status,
      )
    }
    const session = loaded.session
    if (session.status !== 'closed' && session.status !== 'archived') {
      return c.json(
        {
          ok: false,
          error: { code: 'session_not_closed', message: 'Session must be closed to export' },
          trace_id: traceId,
        },
        409,
      )
    }

    const { results: questionRows } = await c.env.DB
      .prepare(
        `SELECT id, position, kind, prompt, options_json
           FROM questions
          WHERE session_id = ?1
       ORDER BY position ASC`,
      )
      .bind(id)
      .all<{ id: string; position: number; kind: string; prompt: string; options_json: string | null }>()

    const voteMap = await loadExportVoteMap(c.env.DB, id)

    const csvEscape = (s: string): string => `"${String(s).replace(/"/g, '""')}"`
    const startedAt = session.started_at ?? null
    const closedAt = session.closed_at ?? null
    const durationMs = startedAt !== null && closedAt !== null ? String(closedAt - startedAt) : ''

    const csvRows: string[] = []
    csvRows.push(['# Session Export', csvEscape(session.title)].join(','))
    csvRows.push(['# Session ID', csvEscape(id)].join(','))
    csvRows.push(['# Status', csvEscape(session.status)].join(','))
    csvRows.push(['# Started', startedAt !== null ? new Date(startedAt).toISOString() : ''].join(','))
    csvRows.push(['# Closed', closedAt !== null ? new Date(closedAt).toISOString() : ''].join(','))
    csvRows.push(['# Duration (ms)', durationMs].join(','))
    csvRows.push(['# Anonymity', csvEscape(session.anonymity)].join(','))
    csvRows.push(['# Exported', new Date().toISOString()].join(','))
    csvRows.push('')

    csvRows.push(
      ['Question #', 'Question Kind', 'Question Prompt', 'Option Label', 'Vote Count', 'Vote %']
        .map(csvEscape)
        .join(','),
    )

    for (const q of questionRows ?? []) {
      const options = parseQuestionOptions(q.options_json)
      const qVotes = voteMap.get(q.id) ?? new Map<string, number>()
      const totalVotes = options.reduce((s, o) => s + (qVotes.get(o.id) ?? 0), 0)
      const positionLabel = String(q.position + 1)

      if (options.length === 0) {
        csvRows.push(
          [positionLabel, csvEscape(q.kind), csvEscape(q.prompt), '', '0', ''].join(','),
        )
        continue
      }
      for (const opt of options) {
        const count = qVotes.get(opt.id) ?? 0
        const pct = totalVotes > 0 ? ((count / totalVotes) * 100).toFixed(1) : '0.0'
        csvRows.push(
          [
            positionLabel,
            csvEscape(q.kind),
            csvEscape(q.prompt),
            csvEscape(opt.label),
            String(count),
            pct,
          ].join(','),
        )
      }
    }

    return new Response(csvRows.join('\r\n'), {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="session-${id}.csv"`,
        'cache-control': 'private, no-store',
      },
    })
  })

  // GET /api/sessions/:id/export.html — EXPORT-PDF-01
  // Print-ready signed HTML export. Browsers can Save As PDF from print dialog.
  // Includes HMAC-SHA256 authenticity code for verifiable exports.
  app.get('/:id/export.html', async (c) => {
    const traceId = c.get('trace_id')
    if (c.get('plan') !== 'team') {
      return c.json(
        {
          ok: false,
          error: { code: 'upgrade_required', message: 'PDF/HTML export requires the Team plan' },
          trace_id: traceId,
        },
        403,
      )
    }
    const user = c.get('user')
    const id = c.req.param('id')
    const loaded = requireFound(await fetchSession(c.env.DB, id, user.sub))
    if (!loaded.ok) {
      return c.json(
        { ok: false, error: { code: loaded.error.code, message: loaded.error.message }, trace_id: traceId },
        loaded.error.status,
      )
    }
    const session = loaded.session
    if (session.status !== 'closed' && session.status !== 'archived') {
      return c.json(
        {
          ok: false,
          error: { code: 'session_not_closed', message: 'Session must be closed to export' },
          trace_id: traceId,
        },
        409,
      )
    }

    const { results: questionRows } = await c.env.DB
      .prepare(
        `SELECT id, position, kind, prompt, options_json
           FROM questions
          WHERE session_id = ?1
       ORDER BY position ASC`,
      )
      .bind(id)
      .all<{ id: string; position: number; kind: string; prompt: string; options_json: string | null }>()

    const voteMap = await loadExportVoteMap(c.env.DB, id)

    const startedAt = session.started_at ?? null
    const closedAt = session.closed_at ?? null
    const durationMs = startedAt !== null && closedAt !== null ? closedAt - startedAt : null

    const questions = (questionRows ?? []).map((q) => {
      const options = parseQuestionOptions(q.options_json)
      const qVotes = voteMap.get(q.id) ?? new Map<string, number>()
      const optionsWithVotes = options.map((o) => ({
        id: o.id,
        label: o.label,
        votes: qVotes.get(o.id) ?? 0,
      }))
      const totalVotes = optionsWithVotes.reduce((s, o) => s + o.votes, 0)
      return {
        id: q.id,
        position: q.position,
        kind: q.kind,
        prompt: q.prompt,
        options: optionsWithVotes,
        total_votes: totalVotes,
      }
    })

    const totalVotes = questions.reduce((s, q) => s + q.total_votes, 0)

    const html = await generateSessionHtmlExport(
      {
        id: session.id,
        title: session.title,
        status: session.status,
        anonymity: session.anonymity,
        team_id: session.team_id ?? null,
        created_at: session.created_at,
        started_at: startedAt,
        closed_at: closedAt,
        duration_ms: durationMs,
        questions,
        total_votes: totalVotes,
      },
      c.env.JWT_SECRET,
    )

    return new Response(html, {
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'content-disposition': `attachment; filename="session-${id}.html"`,
        'cache-control': 'private, no-store',
      },
    })
  })
}
