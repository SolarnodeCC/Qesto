import type { Context } from 'hono'
import { writeEvent } from './observability'
import { loadTeamBranding } from './team-branding'
import { generateSessionHtmlExport } from './export-pdf'
import type { Env, Session } from '../types'
import type { AuthVariables } from '../middleware/auth'
import type { PlanVariables } from '../middleware/plan'

type Vars = AuthVariables & PlanVariables

export function trackSessionExport(
  c: Context<{ Bindings: Env; Variables: Vars }>,
  phase: 'initiated' | 'completed',
  format: string,
  sessionId: string,
  teamId: string | null | undefined,
  durationMs?: number,
): void {
  writeEvent(c.env.METRICS_AE, {
    name: phase === 'initiated' ? 'export.initiated' : 'export.completed',
    userId: c.get('user').sub,
    sessionId,
    teamId: teamId ?? undefined,
    plan: c.get('plan'),
    detail: format,
    ...(durationMs !== undefined ? { durationMs } : {}),
  })
}

export async function loadExportVoteMap(
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

export function parseExportQuestionOptions(rawJson: string | null): { id: string; label: string }[] {
  try {
    const parsed = JSON.parse(rawJson ?? '[]')
    if (Array.isArray(parsed)) return parsed as { id: string; label: string }[]
  } catch {
    // Malformed options_json — treat as open-answer with no options.
  }
  return []
}

export function formatExportDate(ts: number, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZone: 'UTC',
    }).format(new Date(ts))
  } catch {
    return new Date(ts).toISOString()
  }
}

export function acceptExportLocale(acceptLanguage: string | undefined): string {
  if (!acceptLanguage) return 'en-GB'
  const first = acceptLanguage.split(',')[0]?.split(';')[0]?.trim()
  return first && first.length >= 2 ? first : 'en-GB'
}

export async function renderSignedHtmlExport(
  c: Context<{ Bindings: Env; Variables: Vars }>,
  session: Session,
  format: 'html' | 'pdf',
): Promise<Response> {
  const id = session.id
  const exportStarted = Date.now()
  trackSessionExport(c, 'initiated', format, id, session.team_id)

  const { results: questionRows } = await c.env.DB.prepare(
    `SELECT id, position, kind, prompt, options_json FROM questions WHERE session_id = ?1 ORDER BY position ASC`,
  )
    .bind(id)
    .all<{ id: string; position: number; kind: string; prompt: string; options_json: string | null }>()

  const voteMap = await loadExportVoteMap(c.env.DB, id)
  const startedAt = session.started_at ?? null
  const closedAt = session.closed_at ?? null
  const durationMs = startedAt !== null && closedAt !== null ? closedAt - startedAt : null

  const questions = (questionRows ?? []).map((q) => {
    const options = parseExportQuestionOptions(q.options_json)
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

  const branding = await loadTeamBranding(c.env.TEAMS_KV, session.team_id)
  const html = await generateSessionHtmlExport(
    {
      id: session.id,
      title: session.title,
      status: session.status,
      anonymity: session.anonymity,
      team_id: session.team_id ?? null,
      branding,
      created_at: session.created_at,
      started_at: startedAt,
      closed_at: closedAt,
      duration_ms: durationMs,
      questions,
      total_votes: questions.reduce((s, q) => s + q.total_votes, 0),
    },
    c.env.JWT_SECRET,
  )

  trackSessionExport(c, 'completed', format, id, session.team_id, Date.now() - exportStarted)
  const ext = format === 'pdf' ? 'pdf.html' : 'html'
  return new Response(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'content-disposition': `attachment; filename="session-${id}.${ext}"`,
      'cache-control': 'private, no-store',
      ...(format === 'pdf' ? { 'x-export-hint': 'Open in browser and print to PDF' } : {}),
    },
  })
}
