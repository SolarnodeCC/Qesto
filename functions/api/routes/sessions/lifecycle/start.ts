// POST /api/sessions/:id/start — DRAFT → ENERGIZING|LIVE, initialises the DO.
import type { Hono } from 'hono'
import type { Env } from '../../../types'
import type { SessionVars } from '../shared'
import { requireFound, requireDraft } from '../../../lib/session-lifecycle'
import { fetchSession, fetchQuestions, questionToLive, postDO, recordSprint19JourneyEvent } from '../shared'
import { writeEvent } from '../../../lib/observability'
import { trackSessionWrite } from '../../../lib/multi-region-mutation'
import { logEvent } from '../../../lib/log'
import {
  BOARD_MODES_NO_QUESTIONS,
  loadRetroInitExtras,
  loadIdeateInitExtras,
  buildSessionInitBody,
  doInitAlreadyInitialised,
  rollbackSessionStart,
} from './helpers'

export function registerStartRoute(app: Hono<{ Bindings: Env; Variables: SessionVars }>) {
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
    const boardMode = BOARD_MODES_NO_QUESTIONS.has(session.session_mode)
    if (questions.length === 0 && !boardMode) {
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
    const liveQ = questions.length > 0 ? questionToLive(questions[0]) : null
    const boardExtras =
      session.session_mode === 'retro'
        ? await loadRetroInitExtras(c.env, id)
        : session.session_mode === 'ideate'
          ? await loadIdeateInitExtras(c.env, id)
          : {}
    const initBody = () => buildSessionInitBody(session, liveQ, questions, c.get('plan'), boardExtras)
    const logCtx = { trace_id: traceId, session_id: id, user_id: user.sub }

    logEvent({ ts: new Date().toISOString(), level: 'info', event: 'session.start.attempt', ...logCtx })

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
      // A concurrent request already transitioned the session. Confirm the DO is
      // initialised before returning success — DB status alone is not enough
      // (the winner may still be rolling back after a failed /init).
      const current = await fetchSession(c.env.DB, id, user.sub)
      logEvent({ ts: new Date().toISOString(), level: 'info', event: 'session.start.concurrent_win', ...logCtx })
      if (current?.status === 'energizing' || current?.status === 'live') {
        let doRes: Response
        try {
          doRes = await postDO(c.env, id, '/init', initBody())
        } catch {
          const latest = await fetchSession(c.env.DB, id, user.sub)
          if (latest?.status === 'draft') {
            return c.json(
              { ok: false, error: { code: 'conflict', message: 'Session could not be started' }, trace_id: traceId },
              409,
            )
          }
          return c.json(
            {
              ok: false,
              error: { code: 'do_init_failed', message: 'Session room unavailable, please try again' },
              trace_id: traceId,
            },
            500,
          )
        }
        if (doRes.status === 200 || (await doInitAlreadyInitialised(doRes))) {
          return c.json({ ok: true, data: { session: current, question: liveQ }, trace_id: traceId })
        }
        const latest = await fetchSession(c.env.DB, id, user.sub)
        if (latest?.status === 'draft') {
          return c.json(
            { ok: false, error: { code: 'conflict', message: 'Session could not be started' }, trace_id: traceId },
            409,
          )
        }
        return c.json(
          {
            ok: false,
            error: { code: 'do_init_failed', message: 'Session room unavailable, please try again' },
            trace_id: traceId,
          },
          500,
        )
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
      doRes = await postDO(c.env, id, '/init', initBody())
    } catch (doNetworkErr) {

      // Roll back the DB transition so the session remains startable.
      logEvent({ ts: new Date().toISOString(), level: 'error', event: 'session.start.do_network_error', ...logCtx, err: String(doNetworkErr) })
      try {
        await rollbackSessionStart(c.env.DB, id, user.sub, initialStatus, now)
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
      if (await doInitAlreadyInitialised(doRes)) {
        logEvent({ ts: new Date().toISOString(), level: 'info', event: 'session.start.do_idempotent', ...logCtx })
        return c.json({ ok: true, data: { session, question: liveQ }, trace_id: traceId })
      }
      // All other DO errors: roll back DB so the session stays startable.
      logEvent({ ts: new Date().toISOString(), level: 'warn', event: 'session.start.do_failure', ...logCtx, do_status: doRes.status })
      try {
        await rollbackSessionStart(c.env.DB, id, user.sub, initialStatus, now)
      } catch (rbErr) {
        // Rollback failed — DB may be stuck live while DO is not initialised.
        // Operator must use RUNBOOK_SESSION_RECONCILE.md to recover.
        logEvent({ ts: new Date().toISOString(), level: 'error', event: 'session.start.rollback_failed', ...logCtx, err: String(rbErr) })
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
    logEvent({ ts: new Date().toISOString(), level: 'info', event: 'session.start.success', ...logCtx })
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
}
