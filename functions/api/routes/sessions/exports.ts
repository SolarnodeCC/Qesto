// EXPORT-RICH-01-A + EXPORT-PDF-01 — Rich session exports (Team plan only).

import { Hono } from 'hono'
import { requireFound } from '../../lib/session-lifecycle'
import { buildAiRecapProvenance } from '../../lib/ai/recap-provenance'
import { csvRow } from '../../lib/csv'
import {
  acceptExportLocale,
  formatExportDate,
  loadExportVoteMap,
  parseExportQuestionOptions,
  renderSignedHtmlExport,
  trackSessionExport,
} from '../../lib/session-export'
import type { Env } from '../../types'
import type { Session } from '../../types'
import type { AuthVariables } from '../../middleware/auth'
import type { PlanVariables } from '../../middleware/plan'

type Vars = AuthVariables & PlanVariables
type FetchSession = (db: D1Database, id: string, ownerId: string) => Promise<Session | null>

function teamExportDenied(traceId: string, message: string) {
  return { ok: false as const, error: { code: 'upgrade_required', message }, trace_id: traceId }
}

function sessionNotClosed(traceId: string) {
  return { ok: false as const, error: { code: 'session_not_closed', message: 'Session must be closed to export' }, trace_id: traceId }
}

export function mountExportRoutes(
  app: Hono<{ Bindings: Env; Variables: Vars }>,
  fetchSession: FetchSession,
) {
  app.get('/:id/export.json', async (c) => {
    const traceId = c.get('trace_id')
    if (c.get('plan') !== 'team') return c.json(teamExportDenied(traceId, 'Rich export requires the Team plan'), 403)
    const user = c.get('user')
    const id = c.req.param('id')
    const loaded = requireFound(await fetchSession(c.env.DB, id, user.sub))
    if (!loaded.ok) {
      return c.json({ ok: false, error: { code: loaded.error.code, message: loaded.error.message }, trace_id: traceId }, loaded.error.status)
    }
    const session = loaded.session
    if (session.status !== 'closed' && session.status !== 'archived') {
      return c.json(sessionNotClosed(traceId), 409)
    }

    const exportStarted = Date.now()
    trackSessionExport(c, 'initiated', 'json', id, session.team_id)

    const { results: questionRows } = await c.env.DB
      .prepare(
        `SELECT id, position, kind, prompt, options_json FROM questions WHERE session_id = ?1 ORDER BY position ASC`,
      )
      .bind(id)
      .all<{ id: string; position: number; kind: string; prompt: string; options_json: string | null }>()

    const voteMap = await loadExportVoteMap(c.env.DB, id)
    const questionsExport = (questionRows ?? []).map((q) => {
      const options = parseExportQuestionOptions(q.options_json)
      const qVotes = voteMap.get(q.id) ?? new Map<string, number>()
      const optionsWithVotes = options.map((o) => ({ id: o.id, label: o.label, votes: qVotes.get(o.id) ?? 0 }))
      const totalVotes = optionsWithVotes.reduce((s, o) => s + o.votes, 0)
      return { id: q.id, position: q.position, kind: q.kind, prompt: q.prompt, options: optionsWithVotes, total_votes: totalVotes }
    })

    const startedAt = session.started_at ?? null
    const closedAt = session.closed_at ?? null
    const durationMs = startedAt !== null && closedAt !== null ? closedAt - startedAt : null
    trackSessionExport(c, 'completed', 'json', id, session.team_id, Date.now() - exportStarted)

    return new Response(
      JSON.stringify(
        {
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
          total_votes: questionsExport.reduce((s, q) => s + q.total_votes, 0),
          ai_provenance: buildAiRecapProvenance(session),
        },
        null,
        2,
      ),
      {
        headers: {
          'content-type': 'application/json',
          'content-disposition': `attachment; filename="session-${id}.json"`,
          'cache-control': 'private, no-store',
        },
      },
    )
  })

  app.get('/:id/export.csv', async (c) => {
    const traceId = c.get('trace_id')
    if (c.get('plan') !== 'team') return c.json(teamExportDenied(traceId, 'Rich export requires the Team plan'), 403)
    const user = c.get('user')
    const id = c.req.param('id')
    const loaded = requireFound(await fetchSession(c.env.DB, id, user.sub))
    if (!loaded.ok) {
      return c.json({ ok: false, error: { code: loaded.error.code, message: loaded.error.message }, trace_id: traceId }, loaded.error.status)
    }
    const session = loaded.session
    if (session.status !== 'closed' && session.status !== 'archived') {
      return c.json(sessionNotClosed(traceId), 409)
    }

    const exportStarted = Date.now()
    trackSessionExport(c, 'initiated', 'csv', id, session.team_id)

    const { results: questionRows } = await c.env.DB
      .prepare(`SELECT id, position, kind, prompt, options_json FROM questions WHERE session_id = ?1 ORDER BY position ASC`)
      .bind(id)
      .all<{ id: string; position: number; kind: string; prompt: string; options_json: string | null }>()

    const voteMap = await loadExportVoteMap(c.env.DB, id)
    const startedAt = session.started_at ?? null
    const closedAt = session.closed_at ?? null
    const durationMs = startedAt !== null && closedAt !== null ? String(closedAt - startedAt) : ''
    const exportLocale = acceptExportLocale(c.req.header('accept-language'))

    const csvRows: string[] = [
      csvRow(['# Session Export', session.title]),
      csvRow(['# Session ID', id]),
      csvRow(['# Status', session.status]),
      ['# Started', startedAt !== null ? formatExportDate(startedAt, exportLocale) : ''].join(','),
      ['# Closed', closedAt !== null ? formatExportDate(closedAt, exportLocale) : ''].join(','),
      ['# Duration (ms)', durationMs].join(','),
      csvRow(['# Anonymity', session.anonymity]),
      ['# Locale', exportLocale].join(','),
      ['# Exported', formatExportDate(Date.now(), exportLocale)].join(','),
      '',
      csvRow(['Question #', 'Question Kind', 'Question Prompt', 'Option Label', 'Vote Count', 'Vote %']),
    ]

    for (const q of questionRows ?? []) {
      const options = parseExportQuestionOptions(q.options_json)
      const qVotes = voteMap.get(q.id) ?? new Map<string, number>()
      const totalVotes = options.reduce((s, o) => s + (qVotes.get(o.id) ?? 0), 0)
      const positionLabel = String(q.position + 1)
      if (options.length === 0) {
        csvRows.push(csvRow([positionLabel, q.kind, q.prompt, '', '0', '']))
        continue
      }
      for (const opt of options) {
        const count = qVotes.get(opt.id) ?? 0
        const pct = totalVotes > 0 ? ((count / totalVotes) * 100).toFixed(1) : '0.0'
        csvRows.push(csvRow([positionLabel, q.kind, q.prompt, opt.label, count, pct]))
      }
    }

    trackSessionExport(c, 'completed', 'csv', id, session.team_id, Date.now() - exportStarted)
    return new Response(csvRows.join('\r\n'), {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="session-${id}.csv"`,
        'cache-control': 'private, no-store',
      },
    })
  })

  app.get('/:id/export.html', async (c) => {
    const traceId = c.get('trace_id')
    if (c.get('plan') !== 'team') return c.json(teamExportDenied(traceId, 'PDF/HTML export requires the Team plan'), 403)
    const loaded = requireFound(await fetchSession(c.env.DB, c.req.param('id'), c.get('user').sub))
    if (!loaded.ok) {
      return c.json({ ok: false, error: { code: loaded.error.code, message: loaded.error.message }, trace_id: traceId }, loaded.error.status)
    }
    if (loaded.session.status !== 'closed' && loaded.session.status !== 'archived') {
      return c.json(sessionNotClosed(traceId), 409)
    }
    return renderSignedHtmlExport(c, loaded.session, 'html')
  })

  app.get('/:id/export.pdf', async (c) => {
    const traceId = c.get('trace_id')
    if (c.get('plan') !== 'team') return c.json(teamExportDenied(traceId, 'PDF export requires the Team plan'), 403)
    const loaded = requireFound(await fetchSession(c.env.DB, c.req.param('id'), c.get('user').sub))
    if (!loaded.ok) {
      return c.json({ ok: false, error: { code: loaded.error.code, message: loaded.error.message }, trace_id: traceId }, loaded.error.status)
    }
    if (loaded.session.status !== 'closed' && loaded.session.status !== 'archived') {
      return c.json(sessionNotClosed(traceId), 409)
    }
    return renderSignedHtmlExport(c, loaded.session, 'pdf')
  })
}
