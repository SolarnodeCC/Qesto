// Split out of the 758-line sessions/lifecycle.ts (issue #687). Each module
// mounts one lifecycle transition; lifecycle.ts composes them in the original
// order, so routing behaviour is unchanged.

import { Hono } from 'hono'
import type { Env } from '../../types'
import type { SessionVars } from './shared'

import { requireFound, requireDraft } from '../../lib/session-lifecycle'
import {
  fetchSession,
  fetchQuestions,
  questionToLive,
  postDO,
  describeDOError,
  isDeterministicDOFailure,
  recordSprint19JourneyEvent,
} from './shared'
import { writeEvent } from '../../lib/observability'
import { trackSessionWrite } from '../../lib/multi-region-mutation'
import { logEvent } from '../../lib/log'
import { loadRetroInitExtras, loadIdeateInitExtras } from '../../services/sessionLifecycleService'
import {
  countDraftEnergizers,
  startSessionTransition,
  rollbackSessionStart,
  countNonDraftSessions,
} from '../../repositories/sessionLifecycleRepository'
import type { Question, Session } from '../../types'
import type { LiveQuestion } from '../../realtime'

const BOARD_MODES_NO_QUESTIONS = new Set(['retro', 'townhall', 'ideate'])

async function doInitAlreadyInitialised(doRes: Response): Promise<boolean> {
  if (doRes.status !== 409) return false
  try {
    const doBody = (await doRes.json()) as { ok?: boolean; error?: { code?: string } }
    return doBody?.error?.code === 'already_initialised'
  } catch {
    return false
  }
}

function buildSessionInitBody(
  session: Session,
  liveQ: LiveQuestion | null,
  questions: Question[],
  plan: string,
  initialStatus: 'energizing' | 'live',
  extras?: {
    retroDotVoteLimit?: number
    retroCarriedActions?: string[]
    ideateDotVoteLimit?: number
    ideateClusterDebounceMs?: number
  },
) {
  return {
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
    retroDotVoteLimit: extras?.retroDotVoteLimit,
    retroCarriedActions: extras?.retroCarriedActions,
    ideateDotVoteLimit: extras?.ideateDotVoteLimit,
    ideateClusterDebounceMs: extras?.ideateClusterDebounceMs,
    plan,
    initialStatus,
  }
}

// Map a caught `postDO('/init')` rejection to a client-facing envelope. A
// deterministic failure (missing DO binding) is surfaced as a non-retryable
// `do_unavailable` (503) so the browser stops the pointless retry loop; a
// transient stub rejection keeps the retryable `do_init_failed` (500) that the
// client intentionally backs off and retries.
function doThrowResponse(err: unknown): { status: 503 | 500; code: string; message: string } {
  if (isDeterministicDOFailure(err)) {
    return {
      status: 503,
      code: 'do_unavailable',
      message: 'The realtime service is currently unavailable. Please contact support if this persists.',
    }
  }
  return { status: 500, code: 'do_init_failed', message: 'Session room unavailable, please try again' }
}

// Map a DO non-200 `/init` response to a client-facing envelope. The DO refused
// init for a concrete reason (e.g. `do_internal_error`, `bad_request`) — this is
// deterministic, so surface the DO's real code/message under a non-retryable
// `do_init_error` (the client's RETRYABLE_CODES set excludes it) instead of the
// opaque, retryable `do_init_failed`. Falls back to the HTTP status when the DO
// body carries no structured error.
function doRefusedResponse(
  doStatus: number,
  doErr: { error?: { code?: string; message?: string } } | null,
): { code: string; message: string } {
  const doCode = doErr?.error?.code
  const doMessage = doErr?.error?.message
  return {
    code: 'do_init_error',
    message: doCode
      ? `Session room could not start (${doCode}${doMessage ? `: ${doMessage}` : ''})`
      : `Session room refused to start (HTTP ${doStatus})`,
  }
}

export function mountSessionStartRoute(app: Hono<{ Bindings: Env; Variables: SessionVars }>) {
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
    // Check if session has energizers with draft state
    const hasEnergizersToDo = (await countDraftEnergizers(c.env.DB, id)) > 0
    const initialStatus = hasEnergizersToDo ? 'energizing' : 'live'
    const initBody = () => buildSessionInitBody(session, liveQ, questions, c.get('plan'), initialStatus, boardExtras)
    const logCtx = { trace_id: traceId, session_id: id, user_id: user.sub }

    logEvent({ ts: new Date().toISOString(), level: 'info', event: 'session.start.attempt', ...logCtx })

    // Conditional UPDATE: only transitions from draft → (energizing|live).
    // `0 changes` means a concurrent request already won this write.
    const startedChanges = await startSessionTransition(c.env.DB, id, user.sub, initialStatus, now)

    if (startedChanges === 0) {
      // A concurrent request already transitioned the session. Confirm the DO is
      // initialised before returning success — DB status alone is not enough
      // (the winner may still be rolling back after a failed /init).
      const current = await fetchSession(c.env.DB, id, user.sub)
      logEvent({ ts: new Date().toISOString(), level: 'info', event: 'session.start.concurrent_win', ...logCtx })
      if (current?.status === 'energizing' || current?.status === 'live') {
        let doRes: Response
        try {
          doRes = await postDO(c.env, id, '/init', initBody())
        } catch (err) {
          logEvent({
            ts: new Date().toISOString(),
            level: 'error',
            event: 'session.start.do_network_error',
            ...logCtx,
            concurrent: true,
            deterministic: isDeterministicDOFailure(err),
            ...describeDOError(err),
          })
          const latest = await fetchSession(c.env.DB, id, user.sub)
          if (latest?.status === 'draft') {
            return c.json(
              { ok: false, error: { code: 'conflict', message: 'Session could not be started' }, trace_id: traceId },
              409,
            )
          }
          const resp = doThrowResponse(err)
          return c.json(
            { ok: false, error: { code: resp.code, message: resp.message }, trace_id: traceId },
            resp.status,
          )
        }
        if (doRes.status === 200 || (await doInitAlreadyInitialised(doRes))) {
          return c.json({ ok: true, data: { session: current, question: liveQ }, trace_id: traceId })
        }
        const doErr = (await doRes.json().catch(() => null)) as { error?: { code?: string; message?: string } } | null
        logEvent({
          ts: new Date().toISOString(),
          level: 'warn',
          event: 'session.start.do_failure',
          ...logCtx,
          concurrent: true,
          do_status: doRes.status,
          do_error_code: doErr?.error?.code,
          do_error_message: doErr?.error?.message,
        })
        const latest = await fetchSession(c.env.DB, id, user.sub)
        if (latest?.status === 'draft') {
          return c.json(
            { ok: false, error: { code: 'conflict', message: 'Session could not be started' }, trace_id: traceId },
            409,
          )
        }
        const refused = doRefusedResponse(doRes.status, doErr)
        return c.json(
          { ok: false, error: { code: refused.code, message: refused.message }, trace_id: traceId },
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
      logEvent({
        ts: new Date().toISOString(),
        level: 'error',
        event: 'session.start.do_network_error',
        ...logCtx,
        deterministic: isDeterministicDOFailure(doNetworkErr),
        ...describeDOError(doNetworkErr),
      })
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
      const resp = doThrowResponse(doNetworkErr)
      return c.json(
        { ok: false, error: { code: resp.code, message: resp.message }, trace_id: traceId },
        resp.status,
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
      // Capture the DO's own error envelope (code/message) so the failure is
      // correlatable with the matching `do.fetch_unhandled_error` DO-side log.
      const doErr = (await doRes.json().catch(() => null)) as { error?: { code?: string; message?: string } } | null
      logEvent({
        ts: new Date().toISOString(),
        level: 'warn',
        event: 'session.start.do_failure',
        ...logCtx,
        do_status: doRes.status,
        do_error_code: doErr?.error?.code,
        do_error_message: doErr?.error?.message,
      })
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
      const refused = doRefusedResponse(doRes.status, doErr)
      return c.json(
        {
          ok: false,
          error: { code: refused.code, message: refused.message },
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
      const sessionCount = await countNonDraftSessions(c.env.DB, user.sub)
      if (sessionCount === 1) {
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
}
