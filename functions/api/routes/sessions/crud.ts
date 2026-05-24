import { Hono } from 'hono'
import type { Env } from '../../types'
import type { SessionVars } from './shared'

import { ulid } from '../../lib/ulid'
import { generateJoinCode } from '../../lib/code'
import { IdempotencyInFlightError, withIdempotency } from '../../lib/idempotency'
import { incrementSessionQuota } from '../../lib/quota'
import { validateBody } from '../../lib/validate'
import {
  CreateSessionSchema,
  JourneyEventSchema,
  PatchSessionSchema,
  isPatchBodyTitleOnly,
} from '../../lib/validation'
import { validateKvJson, StringArraySchema } from '../../lib/validators'
import { requireFound, requireDraft, requireEditableTitle } from '../../lib/session-lifecycle'
import {
  fetchSession,
  fetchQuestions,
  patchSchemaIfNeeded,
  recordSprint19JourneyEvent,
  upsertPollQuestion,
  deniedQuestionFeature,
  type SessionRow,
  type Sprint19JourneyEvent,
} from './shared'
import type { Session, Question } from '../../types'

export function mountSessionCrudRoutes(app: Hono<{ Bindings: Env; Variables: SessionVars }>) {
  // POST /api/sessions/journey-events — client-side Sprint 19 journey signals.
  app.post('/journey-events', async (c) => {
    const user = c.get('user')
    const traceId = c.get('trace_id')
    await patchSchemaIfNeeded(c.env.DB)

    const validated = await validateBody(c, JourneyEventSchema)
    if ('error' in validated) return validated.error
    const { data: body } = validated

    let session: Session | null = null
    if (body.sessionId) {
      session = await fetchSession(c.env.DB, body.sessionId, user.sub)
      if (!session) {
        return c.json(
          { ok: false, error: { code: 'not_found', message: 'Session not found' }, trace_id: traceId },
          404,
        )
      }
    }

    await recordSprint19JourneyEvent(c.env, {
      name: body.event as Sprint19JourneyEvent,
      userId: user.sub,
      sessionId: session?.id,
      teamId: session?.team_id,
      plan: c.get('plan'),
      count: body.count,
      value: body.value,
      durationMs: body.durationMs,
      traceId,
    })

    return c.json({ ok: true, data: { recorded: true }, trace_id: traceId })
  })

  // POST /api/sessions — create DRAFT
  app.post('/', async (c) => {
    const validated = await validateBody(c, CreateSessionSchema)
    if ('error' in validated) {
      return validated.error
    }
    const { data: body } = validated

    const user = c.get('user')
    const plan = c.get('plan')
    const quotas = c.get('planQuotas')
    const idemKey = c.req.header('idempotency-key') ?? undefined

    // Check quota before proceeding (BILL-04)
    const { allowed, remaining } = await incrementSessionQuota(
      c.env.SESSIONS_KV,
      user.sub,
      quotas.maxSessionsPerMonth,
    )
    if (!allowed) {
      return c.json(
        {
          ok: false,
          error: {
            code: 'quota_exceeded',
            message: `Session quota exceeded for your ${plan} plan this month`,
            details: {
              plan,
              limit: quotas.maxSessionsPerMonth,
              upgrade_url: '/billing/upgrade',
            },
          },
          trace_id: c.get('trace_id'),
        },
        429,
      )
    }

    let result: { status: number; body: { ok: true; data: { session: Session; questions: Question[] } }; replayed: boolean }
    try {
      result = await withIdempotency(
        c.env.ACTIONS_KV,
        user.sub,
        idemKey,
        async () => {
          const id = ulid()
          const code = generateJoinCode()
          const now = Date.now()
          // OBS-001: attribute new session to the user's first team (if any).
          // TEAMS_KV key `user-teams:{userId}` stores `string[]` of teamIds.
          // Null is valid — individual (team-less) sessions remain supported.
          let teamId: string | null = null
          try {
            const raw = await c.env.TEAMS_KV.get(`user-teams:${user.sub}`)
            if (raw) {
              const ids = validateKvJson(raw, StringArraySchema)
              teamId = ids && ids.length > 0 ? ids[0] : null
            }
          } catch {
            // KV lookup is best-effort analytics attribution — never blocks session creation.
            teamId = null
          }
          await c.env.DB.prepare(
            `INSERT INTO sessions (id, owner_id, code, title, status, anonymity, vote_policy, session_mode, created_at, team_id)
             VALUES (?1, ?2, ?3, ?4, 'draft', 'full', 'once', 'reflection', ?5, ?6)`,
          )
            .bind(id, user.sub, code, body.title, now, teamId)
            .run()
          const session: Session = {
            id,
            owner_id: user.sub,
            code,
            title: body.title,
            status: 'draft',
            anonymity: 'full',
            vote_policy: 'once',
            session_mode: 'reflection',
            created_at: now,
            started_at: null,
            closed_at: null,
            archived_at: null,
            team_id: teamId,
          }
          return {
            status: 201,
            body: { ok: true as const, data: { session, questions: [] as Question[], quota_remaining: remaining } },
          }
        },
      )
    } catch (err) {
      if (err instanceof IdempotencyInFlightError) {
        return c.json(
          {
            ok: false,
            error: {
              code: 'idem_in_flight',
              message: 'A previous request with this Idempotency-Key is still in flight. Retry shortly.',
            },
            trace_id: c.get('trace_id'),
          },
          409,
        )
      }
      throw err
    }

    if (result.replayed) c.header('idempotent-replay', 'true')
    return c.json({ ...result.body, trace_id: c.get('trace_id') }, result.status as 201 | 200)
  })

  // GET /api/sessions — list caller's sessions (DRAFT + LIVE + CLOSED, not ARCHIVED)
  app.get('/', async (c) => {
    const user = c.get('user')
    await patchSchemaIfNeeded(c.env.DB)
    const { results } = await c.env.DB
      .prepare(
        `SELECT id, owner_id, code, title, status, anonymity, vote_policy, session_mode,
                created_at, started_at, closed_at, archived_at, team_id
           FROM sessions
          WHERE owner_id = ?1 AND status != 'archived'
          ORDER BY created_at DESC
          LIMIT 100`,
      )
      .bind(user.sub)
      .all<SessionRow>()
    return c.json({ ok: true, data: { sessions: results ?? [] }, trace_id: c.get('trace_id') })
  })

  // GET /api/sessions/:id
  app.get('/:id', async (c) => {
    const user = c.get('user')
    const session = await fetchSession(c.env.DB, c.req.param('id'), user.sub)
    if (!session) {
      return c.json(
        { ok: false, error: { code: 'not_found', message: 'Session not found' }, trace_id: c.get('trace_id') },
        404,
      )
    }
    const questions = await fetchQuestions(c.env.DB, session.id)
    return c.json({ ok: true, data: { session, questions }, trace_id: c.get('trace_id') })
  })

  // PATCH /api/sessions/:id — DRAFT full write; closed/archived title-only
  app.patch('/:id', async (c) => {
    const user = c.get('user')
    const plan = c.get('plan')
    const quotas = c.get('planQuotas')
    const id = c.req.param('id')

    const validated = await validateBody(c, PatchSessionSchema)
    if ('error' in validated) {
      return validated.error
    }
    const { data: body } = validated

    const loaded = requireFound(await fetchSession(c.env.DB, id, user.sub))
    if (!loaded.ok) {
      return c.json(
        { ok: false, error: { code: loaded.error.code, message: loaded.error.message }, trace_id: c.get('trace_id') },
        loaded.error.status,
      )
    }

    const titleOnly = isPatchBodyTitleOnly(body)
    let session: Session
    if (titleOnly) {
      const titlePatch = requireEditableTitle(loaded.session)
      if (!titlePatch.ok) {
        return c.json(
          { ok: false, error: { code: titlePatch.error.code, message: titlePatch.error.message }, trace_id: c.get('trace_id') },
          titlePatch.error.status,
        )
      }
      session = titlePatch.session
    } else {
      const draftPatch = requireDraft(loaded.session, 'patch')
      if (!draftPatch.ok) {
        return c.json(
          { ok: false, error: { code: draftPatch.error.code, message: draftPatch.error.message }, trace_id: c.get('trace_id') },
          draftPatch.error.status,
        )
      }
      session = draftPatch.session
    }

    if (body.title !== undefined) {
      await c.env.DB
        .prepare(`UPDATE sessions SET title = ?1 WHERE id = ?2 AND owner_id = ?3`)
        .bind(body.title, id, user.sub)
        .run()
      session.title = body.title
    }

    if (titleOnly) {
      const questions = await fetchQuestions(c.env.DB, id)
      return c.json({ ok: true, data: { session, questions }, trace_id: c.get('trace_id') })
    }

    if (body.anonymity !== undefined) {
      await c.env.DB
        .prepare(`UPDATE sessions SET anonymity = ?1 WHERE id = ?2 AND owner_id = ?3`)
        .bind(body.anonymity, id, user.sub)
        .run()
      session.anonymity = body.anonymity
    }
    if (body.vote_policy !== undefined) {
      await c.env.DB
        .prepare(`UPDATE sessions SET vote_policy = ?1 WHERE id = ?2 AND owner_id = ?3`)
        .bind(body.vote_policy, id, user.sub)
        .run()
      session.vote_policy = body.vote_policy
    }
    if (body.session_mode !== undefined) {
      await c.env.DB
        .prepare(`UPDATE sessions SET session_mode = ?1 WHERE id = ?2 AND owner_id = ?3`)
        .bind(body.session_mode, id, user.sub)
        .run()
      session.session_mode = body.session_mode
    }
    if (body.ai_generated !== undefined) {
      await c.env.DB
        .prepare(`UPDATE sessions SET ai_generated = ?1 WHERE id = ?2 AND owner_id = ?3`)
        .bind(body.ai_generated ? 1 : 0, id, user.sub)
        .run()
      session.ai_generated = body.ai_generated ? 1 : 0
    }
    if (body.ai_consent_at !== undefined) {
      await c.env.DB
        .prepare(`UPDATE sessions SET ai_consent_at = ?1 WHERE id = ?2 AND owner_id = ?3`)
        .bind(body.ai_consent_at, id, user.sub)
        .run()
      session.ai_consent_at = body.ai_consent_at
    }
    if (body.ai_grounding_hash !== undefined) {
      await c.env.DB
        .prepare(`UPDATE sessions SET ai_grounding_hash = ?1 WHERE id = ?2 AND owner_id = ?3`)
        .bind(body.ai_grounding_hash, id, user.sub)
        .run()
      session.ai_grounding_hash = body.ai_grounding_hash
    }
    if (body.ai_accepted_count !== undefined) {
      await c.env.DB
        .prepare(`UPDATE sessions SET ai_accepted_count = ?1 WHERE id = ?2 AND owner_id = ?3`)
        .bind(body.ai_accepted_count, id, user.sub)
        .run()
      session.ai_accepted_count = body.ai_accepted_count
    }
    if (body.ai_dismissed_count !== undefined) {
      await c.env.DB
        .prepare(`UPDATE sessions SET ai_dismissed_count = ?1 WHERE id = ?2 AND owner_id = ?3`)
        .bind(body.ai_dismissed_count, id, user.sub)
        .run()
      session.ai_dismissed_count = body.ai_dismissed_count
    }
    if (body.ai_recap_edited === true) {
      const editedAt = Date.now()
      await c.env.DB
        .prepare(`UPDATE sessions SET ai_recap_edited_at = ?1 WHERE id = ?2 AND owner_id = ?3`)
        .bind(editedAt, id, user.sub)
        .run()
      session.ai_recap_edited_at = editedAt
    }
    let questions = await fetchQuestions(c.env.DB, id)
    if (body.question) {
      const denied = deniedQuestionFeature(plan, quotas, body.question.kind)
      if (denied) {
        return c.json({ ok: false, error: denied, trace_id: c.get('trace_id') }, 403)
      }
      const q = await upsertPollQuestion(c.env.DB, id, body.question)
      questions = [q]
    }

    return c.json({ ok: true, data: { session, questions }, trace_id: c.get('trace_id') })
  })

  // POST /api/sessions/:id/start — DRAFT → LIVE
}
