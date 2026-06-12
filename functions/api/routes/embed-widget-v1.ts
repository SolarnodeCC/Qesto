/**
 * EMBED-WIDGET-API-01 (ADR-0050) — public, read-only widget data plane.
 *
 * Mounted at `/api/embed/v1` (DELIBERATELY distinct from `/api/v1`, the
 * API-key integrator surface). Every route is fronted by widgetTokenMiddleware
 * (token + origin + revocation) and returns the `{ ok, data, trace_id }`
 * envelope with reflected-allowlist CORS.
 *
 *   POST /api/embed/v1/handshake                     → { participant_token, session, branding }
 *   GET  /api/embed/v1/sessions/:idOrCode/state      → { status, active_question, response_count, ... }
 *   GET  /api/embed/v1/sessions/:idOrCode/results    → { question_id, counts_by_option, total }
 *
 * HARD ANONYMITY GUARANTEE (Pentest #5): this plane is aggregate-only BY
 * CONSTRUCTION. It calls only the COUNT/GROUP-BY accessors in
 * embedWidgetRepository; there is no endpoint and no query shape capable of
 * emitting a voter_id, hash, IP, fingerprint, email, or name. No per-participant
 * identity ever crosses into the third-party page.
 */
import { Hono } from 'hono'
import { widgetTokenMiddleware, type WidgetVars } from '../middleware/widget-token'
import {
  fetchEmbedSession,
  fetchEmbedActiveQuestion,
  widgetResponseCount,
  widgetResultsAggregate,
  type EmbedSessionView,
} from '../repositories/embedWidgetRepository'
import type { Env, EmbedWidgetTokenClaims } from '../types'
import type { ParentApp } from './parent-app'

type Vars = WidgetVars & { trace_id?: string }

type PollOption = { id: string; label: string }

function parseOptions(json: string): PollOption[] {
  try {
    const parsed = JSON.parse(json)
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (o): o is PollOption => !!o && typeof o.id === 'string' && typeof o.label === 'string',
      )
    }
  } catch {
    /* fall through */
  }
  return []
}

/**
 * Resolve the path's :idOrCode and assert it matches the token's session.
 * The token carries BOTH sid and code so a token cannot be pointed at a
 * different session than it was minted for (ADR-0050 §1 code note).
 */
async function resolveTokenSession(
  db: D1Database,
  claims: EmbedWidgetTokenClaims,
  idOrCode: string,
): Promise<EmbedSessionView | null> {
  // The path param must reference the token's own session by either handle.
  if (idOrCode !== claims.sid && idOrCode !== claims.code) return null
  const session = await fetchEmbedSession(db, idOrCode)
  if (!session) return null
  // Defence-in-depth: the resolved row must be the token's session.
  if (session.id !== claims.sid) return null
  return session
}

export function mountEmbedWidgetV1Routes(parent: ParentApp) {
  const app = new Hono<{ Bindings: Env; Variables: Vars }>()
  app.use('*', widgetTokenMiddleware)

  // ── Join handshake — allocate an ANONYMOUS, session-scoped participant token ─
  app.post('/handshake', async (c) => {
    const trace_id = c.get('trace_id')
    const claims = c.get('widget')
    const session = await fetchEmbedSession(c.env.DB, claims.sid)
    if (!session) {
      return c.json({ ok: false, error: { code: 'not_found', message: 'Session not found' }, trace_id }, 404)
    }

    // The participant token is anonymous BY CONSTRUCTION: a random,
    // session-scoped id with NO identity, NO PII, never derived from a user.
    // (v1 is read-only — there is no vote-over-embed write path this sprint; the
    // token is provisioned so a future write scope is additive, not a redesign.)
    const participant_token = `ept_${crypto.randomUUID().replace(/-/g, '')}`

    return c.json({
      ok: true,
      data: {
        participant_token,
        session: {
          code: session.code,
          status: session.status,
          title: session.title,
          anonymity_mode: session.anonymity,
        },
        branding: { theme: 'light' as const },
      },
      trace_id,
    })
  })

  // ── Aggregate live state for render ─────────────────────────────────────────
  app.get('/sessions/:idOrCode/state', async (c) => {
    const trace_id = c.get('trace_id')
    const claims = c.get('widget')
    const session = await resolveTokenSession(c.env.DB, claims, c.req.param('idOrCode'))
    if (!session) {
      return c.json({ ok: false, error: { code: 'not_found', message: 'Session not found' }, trace_id }, 404)
    }

    const q = await fetchEmbedActiveQuestion(c.env.DB, session.id)
    const response_count = await widgetResponseCount(c.env.DB, session.id)

    return c.json({
      ok: true,
      data: {
        status: session.status,
        active_question: q
          ? { id: q.id, kind: q.kind, prompt: q.prompt, options: parseOptions(q.options_json) }
          : null,
        response_count,
      },
      trace_id,
    })
  })

  // ── Aggregate tallies (counts only — the headline anonymity guarantee) ──────
  app.get('/sessions/:idOrCode/results', async (c) => {
    const trace_id = c.get('trace_id')
    const claims = c.get('widget')
    const session = await resolveTokenSession(c.env.DB, claims, c.req.param('idOrCode'))
    if (!session) {
      return c.json({ ok: false, error: { code: 'not_found', message: 'Session not found' }, trace_id }, 404)
    }

    const q = await fetchEmbedActiveQuestion(c.env.DB, session.id)
    if (!q) {
      return c.json({ ok: true, data: { question_id: null, counts_by_option: {}, total: 0 }, trace_id })
    }

    const tallies = await widgetResultsAggregate(c.env.DB, session.id, q.id)
    const counts_by_option: Record<string, number> = {}
    let total = 0
    for (const row of tallies) {
      counts_by_option[row.option_id] = row.count
      total += row.count
    }

    return c.json({ ok: true, data: { question_id: q.id, counts_by_option, total }, trace_id })
  })

  parent.route('/api/embed/v1', app)
}
