// POST /api/sessions/:id/close — LIVE → CLOSED + post-session work fan-out.
// POST /api/sessions/:id/transition-to-live — ENERGIZING → LIVE.
import type { Hono } from 'hono'
import type { Env } from '../../../types'
import type { SessionVars } from '../shared'
import { ulid } from '../../../lib/ulid'
import { requireFound, requireLiveForClose } from '../../../lib/session-lifecycle'
import { fetchSession, getSessionRoomStub } from '../shared'
import { writeEvent } from '../../../lib/observability'
import { trackSessionWrite } from '../../../lib/multi-region-mutation'
import { logEvent } from '../../../lib/log'
import { enqueuePostSessionWork, computePayloadHash } from '../../../lib/queues/producer'
import { mergeRetroActionsOnClose } from '../../../lib/workspace-actions'
import { persistRetroHealthSnapshot } from '../../../lib/workspace-trends'

export function registerCloseRoute(app: Hono<{ Bindings: Env; Variables: SessionVars }>) {
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
      const questionsResult = await c.env.DB
        .prepare('SELECT COUNT(*) as cnt FROM questions WHERE session_id = ?')
        .bind(id)
        .first<{ cnt: number }>()
      const questionCount = questionsResult?.cnt ?? 0
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
