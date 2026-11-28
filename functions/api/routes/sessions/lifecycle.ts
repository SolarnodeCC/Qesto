// Session lifecycle routes: DRAFT → ENERGIZING/LIVE → CLOSED.
//
// The start and close handlers were split into sibling modules (issue #687);
// this file composes them and keeps the transition-to-live route.

import { errorResponse } from '../../lib/error-handler'
import { Hono } from 'hono'
import type { Env } from '../../types'
import type { SessionVars } from './shared'

import { requireFound } from '../../lib/session-lifecycle'
import {
  fetchSession,
  postDO,
  describeDOError,
} from './shared'
import { logEvent } from '../../lib/log'
import {
  transitionEnergizingToLive,
} from '../../repositories/sessionLifecycleRepository'



// Map a caught `postDO('/init')` rejection to a client-facing envelope. A
// deterministic failure (missing DO binding) is surfaced as a non-retryable
// `do_unavailable` (503) so the browser stops the pointless retry loop; a
// transient stub rejection keeps the retryable `do_init_failed` (500) that the
// client intentionally backs off and retries.

// Map a DO non-200 `/init` response to a client-facing envelope. The DO refused
// init for a concrete reason (e.g. `do_internal_error`, `bad_request`) — this is
// deterministic, so surface the DO's real code/message under a non-retryable
// `do_init_error` (the client's RETRYABLE_CODES set excludes it) instead of the
// opaque, retryable `do_init_failed`. Falls back to the HTTP status when the DO
// body carries no structured error.

import { mountSessionStartRoute } from './lifecycle-start'
import { mountSessionCloseRoute } from './lifecycle-close'

export function mountLifecycleRoutes(app: Hono<{ Bindings: Env; Variables: SessionVars }>) {
  mountSessionStartRoute(app)
  mountSessionCloseRoute(app)

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

    // DO FIRST, then D1. The old order committed D1=`live` and then made a
    // best-effort, unchecked DO call: if it failed the room stayed
    // `energizing` (votes/advance/joins rejected) while every retry got 409
    // because D1 was no longer `energizing`. The DO transition is idempotent
    // (`transitioned:false` when already live), so retrying this route after
    // any partial failure converges.
    let doRes: Response
    try {
      doRes = await postDO(c.env, id, '/transition-to-live')
    } catch (err) {
      logEvent({
        ts: new Date().toISOString(),
        level: 'error',
        event: 'session.transition_to_live.do_network_error',
        trace_id: traceId,
        session_id: id,
        user_id: user.sub,
        ...describeDOError(err),
      }, 'error')
      return errorResponse(c, 503, 'do_unavailable', 'Session room unavailable, please try again')
    }
    if (!doRes.ok) {
      logEvent({
        event: 'session.transition_to_live.do_rejected',
        trace_id: traceId,
        session_id: id,
        status: doRes.status,
      }, 'error')
      return errorResponse(c, 503, 'do_unavailable', 'Session room unavailable, please try again')
    }

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

    session.status = 'live'
    return c.json({
      ok: true,
      data: { session },
      trace_id: traceId,
    })
  })
}
