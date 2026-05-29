import { Hono } from 'hono'
import type { Env } from '../../types'
import type { SessionVars } from './shared'

import { ulid } from '../../lib/ulid'
import { requireFound, requireDraft, requireLiveForClose } from '../../lib/session-lifecycle'
import {
  fetchSession,
  fetchQuestions,
  questionToLive,
  postDO,
  getSessionRoomStub,
  recordSprint19JourneyEvent,
  precomputeInsights,
} from './shared'
import { writeEvent } from '../../lib/observability'
import { notifySlackSessionClosed, notifyTeamsSessionClosed } from '../integrations'
import { deliverTeamWebhooks } from '../../lib/webhooks'
import { deliverMarketingWebhook } from '../../lib/webhooks-marketing'
import { trackSessionWrite } from '../../lib/multi-region-mutation'

export function mountLifecycleRoutes(app: Hono<{ Bindings: Env; Variables: SessionVars }>) {
  app.post('/:id/start', async (c) => {
    const user = c.get('user')
    const id = c.req.param('id')
    const traceId = c.get('trace_id')
    const startLoaded = requireFound(await fetchSession(c.env.DB, id, user.sub))
    if (!startLoaded.ok) {
      return c.json(
        { ok: false, error: { code: startLoaded.error.code, message: startLoaded.error.message }, trace_id: traceId },
        startLoaded.error.status,
      )
    }
    await recordSprint19JourneyEvent(c.env, {
      name: 'launchpad.launch_attempt',
      userId: user.sub,
      sessionId: id,
      teamId: startLoaded.session.team_id,
      plan: c.get('plan'),
      traceId,
    })
    const draftStart = requireDraft(startLoaded.session, 'start')
    if (!draftStart.ok) {
      await recordSprint19JourneyEvent(c.env, {
        name: 'launchpad.launch_failed',
        userId: user.sub,
        sessionId: id,
        teamId: startLoaded.session.team_id,
        plan: c.get('plan'),
        value: 1,
        traceId,
      })
      return c.json(
        { ok: false, error: { code: draftStart.error.code, message: draftStart.error.message }, trace_id: traceId },
        draftStart.error.status,
      )
    }
    const session = draftStart.session
    const questions = await fetchQuestions(c.env.DB, id)
    if (questions.length === 0) {
      await recordSprint19JourneyEvent(c.env, {
        name: 'launchpad.launch_failed',
        userId: user.sub,
        sessionId: id,
        teamId: session.team_id,
        plan: c.get('plan'),
        value: 1,
        traceId,
      })
      return c.json(
        {
          ok: false,
          error: { code: 'no_question', message: 'Session has no question yet' },
          trace_id: traceId,
        },
        409,
      )
    }
    const now = Date.now()
    const liveQ = questionToLive(questions[0])
    const logCtx = { trace_id: traceId, session_id: id, user_id: user.sub }

    console.log(JSON.stringify({ ts: new Date().toISOString(), level: 'info', event: 'session.start.attempt', ...logCtx }))

    // Check if session has energizers with draft state
    const energizers = await c.env.DB
      .prepare(`SELECT COUNT(*) as n FROM energizers WHERE session_id = ?1 AND state = 'draft'`)
      .bind(id)
      .first<{ n: number }>()
    const hasEnergizersToDo = (energizers?.n ?? 0) > 0
    const initialStatus = hasEnergizersToDo ? 'energizing' : 'live'

    // Conditional UPDATE: only transitions from draft → (energizing|live).
    // `meta.changes === 0` means a concurrent request already won this write.
    const result = await c.env.DB
      .prepare(
        `UPDATE sessions SET status = ?1, started_at = ?2
         WHERE id = ?3 AND owner_id = ?4 AND status = 'draft'`,
      )
      .bind(initialStatus, now, id, user.sub)
      .run()

    if (result.meta.changes === 0) {
      // A concurrent request already transitioned the session. Re-read it and
      // return success without a redundant DO /init call.
      const current = await fetchSession(c.env.DB, id, user.sub)
      console.log(JSON.stringify({ ts: new Date().toISOString(), level: 'info', event: 'session.start.concurrent_win', ...logCtx }))
      if (current?.status === 'energizing' || current?.status === 'live') {
        return c.json({ ok: true, data: { session: current, question: liveQ }, trace_id: traceId })
      }
      return c.json(
        { ok: false, error: { code: 'conflict', message: 'Session could not be started' }, trace_id: traceId },
        409,
      )
    }
    session.status = initialStatus
    session.started_at = now

    let doRes: Response
    try {
      doRes = await postDO(c.env, id, '/init', {
        sessionId: session.id,
        ownerId: session.owner_id,
        teamId: session.team_id ?? undefined,
        code: session.code,
        title: session.title,
        question: liveQ,
        questions: questions.map(questionToLive),
        votePolicy: session.vote_policy,
        sessionMode: session.session_mode,
        anonymity: session.anonymity ?? undefined,
        townhallModeration: session.townhall_moderation ?? undefined,
        plan: c.get('plan'),
      })
    } catch (doNetworkErr) {
      
      // Roll back the DB transition so the session remains startable.
      console.log(JSON.stringify({ ts: new Date().toISOString(), level: 'error', event: 'session.start.do_network_error', ...logCtx, err: String(doNetworkErr) }))
      try {
        await c.env.DB
          .prepare(`UPDATE sessions SET status = 'draft', started_at = NULL WHERE id = ?1`)
          .bind(id)
          .run()
      } catch { /* best-effort rollback */ }
      await recordSprint19JourneyEvent(c.env, {
        name: 'launchpad.launch_failed',
        userId: user.sub,
        sessionId: id,
        teamId: session.team_id,
        plan: c.get('plan'),
        value: 1,
        traceId,
      })
      return c.json(
        { ok: false, error: { code: 'do_init_failed', message: 'Session room unavailable, please try again' }, trace_id: traceId },
        500,
      )
    }
    if (doRes.status !== 200) {
      // Defence-in-depth: if DO returns already_initialised (409), another
      // concurrent start won the DO race. DB is already live — no rollback.
      if (doRes.status === 409) {
        try {
          const doBody = (await doRes.json()) as { ok?: boolean; error?: { code?: string } }
          if (doBody?.error?.code === 'already_initialised') {
            console.log(JSON.stringify({ ts: new Date().toISOString(), level: 'info', event: 'session.start.do_idempotent', ...logCtx }))
            return c.json({ ok: true, data: { session, question: liveQ }, trace_id: traceId })
          }
        } catch { /* fall through to rollback */ }
      }
      // All other DO errors: roll back DB so the session stays startable.
      console.log(JSON.stringify({ ts: new Date().toISOString(), level: 'warn', event: 'session.start.do_failure', ...logCtx, do_status: doRes.status }))
      try {
        await c.env.DB
          .prepare(`UPDATE sessions SET status = 'draft', started_at = NULL WHERE id = ?1`)
          .bind(id)
          .run()
      } catch (rbErr) {
        // Rollback failed — DB may be stuck live while DO is not initialised.
        // Operator must use RUNBOOK_SESSION_RECONCILE.md to recover.
        console.log(JSON.stringify({ ts: new Date().toISOString(), level: 'error', event: 'session.start.rollback_failed', ...logCtx, err: String(rbErr) }))
      }
      await recordSprint19JourneyEvent(c.env, {
        name: 'launchpad.launch_failed',
        userId: user.sub,
        sessionId: id,
        teamId: session.team_id,
        plan: c.get('plan'),
        value: 1,
        traceId,
      })
      return c.json(
        {
          ok: false,
          error: { code: 'do_init_failed', message: `DurableObject refused init (${doRes.status})` },
          trace_id: traceId,
        },
        500,
      )
    }
    console.log(JSON.stringify({ ts: new Date().toISOString(), level: 'info', event: 'session.start.success', ...logCtx }))
    await recordSprint19JourneyEvent(c.env, {
      name: 'launchpad.launch_success',
      userId: user.sub,
      sessionId: id,
      teamId: session.team_id,
      plan: c.get('plan'),
      traceId,
    })
    writeEvent(c.env.METRICS_AE, {
      name: 'session.started',
      sessionId: id,
      userId: user.sub,
      ...(session.team_id ? { teamId: session.team_id } : {}),
      plan: c.get('plan'),
      traceId,
    })

    // OBS-003: emit `first_session_started` iff this is the user's first non-draft session.
    // The draft→live UPDATE above already committed, so count includes this session (==1).
    try {
      const sessionCount = await c.env.DB
        .prepare(`SELECT COUNT(*) as n FROM sessions WHERE owner_id = ?1 AND status != 'draft'`)
        .bind(user.sub)
        .first<{ n: number }>()
      if ((sessionCount?.n ?? 0) === 1) {
        writeEvent(c.env.METRICS_AE, {
          name: 'first_session_started',
          userId: user.sub,
          ...(session.team_id ? { teamId: session.team_id } : {}),
          plan: c.get('plan'),
          traceId,
        })
      }
    } catch {
      // Best-effort analytics — never fail the start response.
    }

    trackSessionWrite(c, 'sessions.start')
    return c.json({
      ok: true,
      data: { session, question: liveQ },
      trace_id: traceId,
    })
  })

  // POST /api/sessions/:id/close — LIVE → CLOSED, persist totals.
  app.post('/:id/close', async (c) => {
    const user = c.get('user')
    const id = c.req.param('id')
    const closeLoaded = requireFound(await fetchSession(c.env.DB, id, user.sub))
    if (!closeLoaded.ok) {
      return c.json(
        { ok: false, error: { code: closeLoaded.error.code, message: closeLoaded.error.message }, trace_id: c.get('trace_id') },
        closeLoaded.error.status,
      )
    }
    const liveClose = requireLiveForClose(closeLoaded.session)
    if (!liveClose.ok) {
      return c.json(
        { ok: false, error: { code: liveClose.error.code, message: liveClose.error.message }, trace_id: c.get('trace_id') },
        liveClose.error.status,
      )
    }
    const session = liveClose.session
    const room = await getSessionRoomStub(c.env, id)
    const doRes = await room.fetch('https://do.internal/close', { method: 'POST' })
    const parsed = (await doRes.json().catch(() => null)) as
      | {
          ok: true
          data: {
            counts: Record<string, number>
            total: number
            votes: Array<{ voterId: string; optionId: string }>
            questionId: string | null
          }
        }
      | null
    const counts = parsed?.ok ? parsed.data.counts : {}
    const total = parsed?.ok ? parsed.data.total : 0
    const voteList = parsed?.ok ? parsed.data.votes : []
    const questionId = parsed?.ok ? parsed.data.questionId : null

    // Persist per-voter rows to D1. UNIQUE(question_id, voter_id) guards
    // against replay.
    if (questionId && voteList.length > 0) {
      const stmt = c.env.DB.prepare(
        `INSERT OR IGNORE INTO votes (id, session_id, question_id, voter_id, option_id, submitted_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
      )
      const ts = Date.now()
      const batch = voteList.map((v) =>
        stmt.bind(ulid(), id, questionId, v.voterId, v.optionId, ts),
      )
      await c.env.DB.batch(batch)
    }

    const closedAt = Date.now()
    await c.env.DB
      .prepare(`UPDATE sessions SET status = 'closed', closed_at = ?1 WHERE id = ?2 AND owner_id = ?3`)
      .bind(closedAt, id, user.sub)
      .run()
    session.status = 'closed'
    session.closed_at = closedAt

    const durationMs = session.started_at ? closedAt - session.started_at : 0
    writeEvent(c.env.METRICS_AE, {
      name: 'session.closed',
      sessionId: id,
      userId: user.sub,
      ...(session.team_id ? { teamId: session.team_id } : {}),
      plan: c.get('plan'),
      durationMs,
      count: total,
      traceId: c.get('trace_id'),
    })

    // Background insight pre-computation: fires after response is sent, never
    // delays the close. Only runs for team-plan users; skips if already cached.
    // Hono throws "This context has no ExecutionContext" when no ctx is passed
    // (e.g. in tests), so we guard with try/catch rather than optional chaining.
    try {
      c.executionCtx.waitUntil(
        precomputeInsights(c.env, id, session.title, user.sub).catch((err) => {
          console.log(
            JSON.stringify({
              event: 'insights.precompute.error',
              sessionId: id,
              error: String(err),
            }),
          )
        }),
      )
    } catch {
      // No ExecutionContext available (test environment) — skip background work.
    }

    // SLACK-01: best-effort Slack notification on session close. Runs in the
    // background via waitUntil so it never delays the close response; ignored
    // when integrations are disabled or no Slack token is bound to this team.
    if (c.env.INTEGRATION_ENABLED === '1' && c.env.INTEGRATIONS_KV) {
      try {
        c.executionCtx.waitUntil(
          notifySlackSessionClosed(c.env, id, session.title, session.team_id ?? null, counts, total).catch((err) => {
            console.error(
              JSON.stringify({ event: 'slack.notify.error', sessionId: id, error: String(err) }),
            )
          }),
        )
      } catch {
        // No ExecutionContext available (test environment) — skip background work.
      }
    }

    // TEAMS-01: best-effort Microsoft Teams Adaptive Card notification on close.
    // Mirrors the Slack hook above; skipped silently when no Teams config exists.
    if (c.env.INTEGRATION_ENABLED === '1' && c.env.INTEGRATIONS_KV) {
      try {
        c.executionCtx.waitUntil(
          notifyTeamsSessionClosed(c.env, id, session.title, session.team_id ?? null, counts, total).catch((err) => {
            console.error(
              JSON.stringify({ event: 'teams.notify.error', sessionId: id, error: String(err) }),
            )
          }),
        )
      } catch {
        // No ExecutionContext available (test environment) — skip background work.
      }
    }

    // WEBHOOK-01: fire generic outbound webhooks on session close. Best-effort,
    // runs via waitUntil so it never delays the close response. Per-webhook
    // failures land in the delivery log (admin-readable) and do not propagate.
    if (c.env.INTEGRATIONS_KV) {
      try {
        c.executionCtx.waitUntil(
          deliverTeamWebhooks(c.env, session.team_id ?? null, 'session.closed', {
            sessionId: id,
            sessionTitle: session.title,
            teamId: session.team_id ?? null,
            totalVotes: total,
            durationMs: session.started_at ? closedAt - session.started_at : 0,
          }).catch((err) =>
            console.error(
              JSON.stringify({ event: 'webhook.deliver.error', sessionId: id, error: String(err) }),
            ),
          ),
        )
      } catch {
        // No ExecutionContext available (test environment) — skip background work.
      }
    }

    // GROWTH-ENGINE: Internal marketing webhook trigger on session close.
    // Fires only if is_public=1 (default) and MARKETING_WEBHOOK_SECRET is set.
    // Best-effort via waitUntil — never delays the close response.
    if ((session.is_public ?? 1) && c.env.MARKETING_WEBHOOK_SECRET) {
      try {
        const questionsResult = await c.env.DB
          .prepare('SELECT COUNT(*) as cnt FROM questions WHERE session_id = ?')
          .bind(id)
          .first<{ cnt: number }>()
        const questionCount = questionsResult?.cnt ?? 0
        const durationMinutes = session.started_at
          ? Math.round((closedAt - session.started_at) / 60000)
          : 0
        c.executionCtx.waitUntil(
          deliverMarketingWebhook(c.env, {
            sessionId: id,
            isPublic: Boolean(session.is_public ?? 1),
            language: 'en' as const,
            sessionMode: session.session_mode ?? 'reflection',
            questionCount,
            participantCount: total,
            responseRate: total > 0 ? 1.0 : 0.0,
            durationMinutes,
            templateUsed: null,
            energizerUsed: false,
          }).catch((err) =>
            console.error(
              JSON.stringify({ event: 'webhook.marketing.error', sessionId: id, error: String(err) }),
            ),
          ),
        )
      } catch {
        // No ExecutionContext available (test environment) — skip background work.
      }
    }

    trackSessionWrite(c, 'sessions.close')
    return c.json({
      ok: true,
      data: { session, results: { counts, total } },
      trace_id: c.get('trace_id'),
    })
  })

  // POST /api/sessions/:id/transition-to-live — ENERGIZING → LIVE.
  // Transitions a session from ENERGIZING state (after energizers) to LIVE (show questions).
  app.post('/:id/transition-to-live', async (c) => {
    const user = c.get('user')
    const id = c.req.param('id')
    const traceId = c.get('trace_id')
    const loaded = requireFound(await fetchSession(c.env.DB, id, user.sub))
    if (!loaded.ok) {
      return c.json(
        { ok: false, error: { code: loaded.error.code, message: loaded.error.message }, trace_id: traceId },
        loaded.error.status,
      )
    }
    const session = loaded.session
    if (session.status !== 'energizing') {
      return c.json(
        {
          ok: false,
          error: {
            code: 'conflict',
            message: 'Session must be in ENERGIZING state to transition to LIVE',
          },
          trace_id: traceId,
        },
        409,
      )
    }

    // Update DB status to live
    const result = await c.env.DB
      .prepare(`UPDATE sessions SET status = 'live' WHERE id = ?1 AND owner_id = ?2 AND status = 'energizing'`)
      .bind(id, user.sub)
      .run()

    if (result.meta.changes === 0) {
      return c.json(
        {
          ok: false,
          error: { code: 'conflict', message: 'Session could not be transitioned to LIVE' },
          trace_id: traceId,
        },
        409,
      )
    }

    // Notify DO to update its internal state (if it exists)
    try {
      const room = await getSessionRoomStub(c.env, id)
      await room.fetch('https://do.internal/transition-to-live', { method: 'POST' })
    } catch {
    }

    session.status = 'live'
    return c.json({
      ok: true,
      data: { session },
      trace_id: traceId,
    })
  })
}
