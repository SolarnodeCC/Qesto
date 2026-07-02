import { Hono } from 'hono'
import type { Env } from '../../types'
import type { SessionVars } from './shared'

import { requireFound, requireDraft, requireLiveForClose } from '../../lib/session-lifecycle'
import {
  fetchSession,
  fetchQuestions,
  questionToLive,
  postDO,
  getSessionRoomStub,
  recordSprint19JourneyEvent,
} from './shared'
import { writeEvent } from '../../lib/observability'
import { trackSessionWrite } from '../../lib/multi-region-mutation'
import { logEvent } from '../../lib/log'
import { enqueuePostSessionWork, computePayloadHash } from '../../lib/queues/producer'
import { mergeRetroActionsOnClose } from '../../lib/workspace-actions'
import { persistRetroHealthSnapshot } from '../../lib/workspace-trends'
import { loadRetroInitExtras, loadIdeateInitExtras } from '../../services/sessionLifecycleService'
import {
  countDraftEnergizers,
  startSessionTransition,
  rollbackSessionStart,
  countNonDraftSessions,
  insertCloseVotes,
  markSessionClosed,
  countSessionQuestions,
  transitionEnergizingToLive,
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
    const initBody = () => buildSessionInitBody(session, liveQ, questions, c.get('plan'), initialStatus, boardExtras)
    const logCtx = { trace_id: traceId, session_id: id, user_id: user.sub }

    logEvent({ ts: new Date().toISOString(), level: 'info', event: 'session.start.attempt', ...logCtx })

    // Check if session has energizers with draft state
    const hasEnergizersToDo = (await countDraftEnergizers(c.env.DB, id)) > 0
    const initialStatus = hasEnergizersToDo ? 'energizing' : 'live'

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
    if (!doRes.ok) {
      return c.json(
        {
          ok: false,
          error: { code: 'do_close_failed', message: 'Session room unavailable, please try again' },
          trace_id: c.get('trace_id'),
        },
        500,
      )
    }
    const parsed = (await doRes.json().catch(() => null)) as
      | {
          ok: true
          data: {
            counts: Record<string, number>
            total: number
            votes: Array<{ voterId: string; optionId: string }>
            questionId: string | null
            retroActionItems?: string[]
            retroStats?: { wentWell: number; didntGoWell: number; actions: number; totalCards: number }
          }
        }
      | null
    const counts = parsed?.ok ? parsed.data.counts : {}
    const total = parsed?.ok ? parsed.data.total : 0
    const voteList = parsed?.ok ? parsed.data.votes : []
    const questionId = parsed?.ok ? parsed.data.questionId : null
    if (parsed?.ok !== true) {
      return c.json(
        {
          ok: false,
          error: { code: 'do_close_failed', message: 'Session room returned an invalid close response' },
          trace_id: c.get('trace_id'),
        },
        500,
      )
    }

    // Persist per-voter rows to D1. UNIQUE(question_id, voter_id) guards
    // against replay.
    if (questionId && voteList.length > 0) {
      await insertCloseVotes(c.env.DB, id, questionId, voteList, Date.now())
    }

    const closedAt = Date.now()
    await markSessionClosed(c.env.DB, id, user.sub, closedAt)
    session.status = 'closed'
    session.closed_at = closedAt

    if (session.session_mode === 'retro' && session.anonymity !== 'zero_knowledge') {
      if (parsed.data.retroStats) {
        try {
          await persistRetroHealthSnapshot(c.env.DB, {
            sessionId: id,
            teamId: session.team_id ?? null,
            closedAt,
            stats: parsed.data.retroStats,
          })
        } catch (err) {
          logEvent({ event: 'retro.health_snapshot_failed', sessionId: id, err: String(err) })
        }
      }
      if (session.workspace_id && session.team_id && c.env.ACTIONS_KV && parsed.data.retroActionItems?.length) {
        try {
          await mergeRetroActionsOnClose(
            c.env.ACTIONS_KV,
            session.team_id,
            session.workspace_id,
            id,
            parsed.data.retroActionItems,
          )
        } catch (err) {
          logEvent({
            event: 'retro.merge_actions_failed',
            sessionId: id,
            workspaceId: session.workspace_id,
            err: String(err),
          })
        }
      }
    }

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

    // Phase 2.1: Async work queues — fire & forget, non-blocking
    // All post-session work enqueued to INSIGHTS_QUEUE; processed asynchronously by consumer.
    const enqueuePromises: Promise<void>[] = []

    // Insights: precompute AI insights for team-plan users
    if (c.get('plan') === 'team') {
      const hash = computePayloadHash({
        sessionTitle: session.title,
        plan: c.get('plan'),
        anonymity: session.anonymity,
      })
      enqueuePromises.push(
        enqueuePostSessionWork(c.env, {
          idempotencyKey: `${id}:precompute_insights:${hash}`,
          sessionId: id,
          userId: user.sub,
          ...(session.team_id ? { teamId: session.team_id } : {}),
          taskType: 'precompute_insights',
          payload: {
            sessionTitle: session.title,
            anonymity: session.anonymity ?? null,
            plan: c.get('plan'),
            traceId: c.get('trace_id'),
          },
          meta: { enqueuedAt: Date.now() },
        }).catch((err) => {
          logEvent({
            event: 'queue.insights.enqueue_error',
            sessionId: id,
            error: String(err),
          })
        }),
      )
    }

    // PULSE (ADR-0057): async aggregation rollup for team-scoped sessions
    if (c.get('plan') === 'team' && session.team_id && session.anonymity !== 'zero_knowledge') {
      const pulseHash = computePayloadHash({ sessionId: id, closedAt })
      enqueuePromises.push(
        enqueuePostSessionWork(c.env, {
          idempotencyKey: `${id}:pulse_rollup:${pulseHash}`,
          sessionId: id,
          userId: user.sub,
          teamId: session.team_id,
          taskType: 'pulse_rollup',
          payload: {},
          meta: { enqueuedAt: Date.now() },
        }).catch((err) => {
          logEvent({
            event: 'queue.pulse.enqueue_error',
            sessionId: id,
            error: String(err),
          })
        }),
      )
    }

    // Slack notification: if integration enabled and team has Slack token
    if (c.env.INTEGRATION_ENABLED === 'true' && c.env.INTEGRATIONS_KV) {
      const hash = computePayloadHash({ sessionTitle: session.title, total })
      enqueuePromises.push(
        enqueuePostSessionWork(c.env, {
          idempotencyKey: `${id}:notify_slack:${hash}`,
          sessionId: id,
          userId: user.sub,
          ...(session.team_id ? { teamId: session.team_id } : {}),
          taskType: 'notify_slack',
          payload: { counts, total },
          meta: { enqueuedAt: Date.now() },
        }).catch((err) => {
          logEvent({
            event: 'queue.slack.enqueue_error',
            sessionId: id,
            error: String(err),
          })
        }),
      )
    }

    // Teams notification: similar to Slack
    if (c.env.INTEGRATION_ENABLED === 'true' && c.env.INTEGRATIONS_KV) {
      const hash = computePayloadHash({ sessionTitle: session.title, total })
      enqueuePromises.push(
        enqueuePostSessionWork(c.env, {
          idempotencyKey: `${id}:notify_teams:${hash}`,
          sessionId: id,
          userId: user.sub,
          ...(session.team_id ? { teamId: session.team_id } : {}),
          taskType: 'notify_teams',
          payload: { counts, total },
          meta: { enqueuedAt: Date.now() },
        }).catch((err) => {
          logEvent({
            event: 'queue.teams.enqueue_error',
            sessionId: id,
            error: String(err),
          })
        }),
      )
    }

    // Webhooks: deliver team webhooks on session close
    if (c.env.INTEGRATIONS_KV) {
      const hash = computePayloadHash({ sessionTitle: session.title, total })
      enqueuePromises.push(
        enqueuePostSessionWork(c.env, {
          idempotencyKey: `${id}:deliver_webhook:${hash}`,
          sessionId: id,
          userId: user.sub,
          ...(session.team_id ? { teamId: session.team_id } : {}),
          taskType: 'deliver_webhook',
          payload: {
            event: 'session.closed',
            data: {
              sessionId: id,
              sessionTitle: session.title,
              totalVotes: total,
              durationMs: session.started_at ? closedAt - session.started_at : 0,
            },
          },
          meta: { enqueuedAt: Date.now() },
        }).catch((err) => {
          logEvent({
            event: 'queue.webhook.enqueue_error',
            sessionId: id,
            error: String(err),
          })
        }),
      )
    }

    // Marketing webhook: internal trigger for analytics/growth (public sessions only)
    if ((session.is_public ?? 1) && c.env.MARKETING_WEBHOOK_SECRET) {
      const questionCount = await countSessionQuestions(c.env.DB, id)
      const hash = computePayloadHash({ sessionTitle: session.title, questionCount })
      enqueuePromises.push(
        enqueuePostSessionWork(c.env, {
          idempotencyKey: `${id}:deliver_marketing:${hash}`,
          sessionId: id,
          userId: user.sub,
          ...(session.team_id ? { teamId: session.team_id } : {}),
          taskType: 'deliver_marketing',
          payload: {
            isPublic: Boolean(session.is_public ?? 1),
            language: 'en',
            sessionMode: session.session_mode ?? 'reflection',
            questionCount,
            participantCount: total,
            responseRate: total > 0 ? 1.0 : 0.0,
          },
          meta: { enqueuedAt: Date.now() },
        }).catch((err) => {
          logEvent({
            event: 'queue.marketing.enqueue_error',
            sessionId: id,
            error: String(err),
          })
        }),
      )
    }

    // Fire & forget: if any fail to enqueue, they're logged but don't block the response
    Promise.all(enqueuePromises).catch((err) => {
      logEvent({
        event: 'queue.bulk_enqueue_error',
        sessionId: id,
        error: String(err),
      })
    })

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
    const changed = await transitionEnergizingToLive(c.env.DB, id, user.sub)

    if (changed === 0) {
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
