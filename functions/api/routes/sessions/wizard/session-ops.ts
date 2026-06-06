import { Hono } from 'hono'
import type { Env, Session } from '../../../types'
import type { SessionVars } from '../shared'

import { validateBody } from '../../../lib/request-validation'
import { DuplicateSessionSchema } from '../../../lib/domain-schemas'
import { ensurePersonalTeam } from '../../teams'
import { hardDeleteSession } from '../../../lib/session-delete'
import { suggestDuplicateTitle } from '../../../lib/session-title'
import { ulid } from '../../../lib/ulid'
import { generateJoinCode } from '../../../lib/code'
import { incrementSessionQuota } from '../../../lib/quota'
import { fetchOwnerSessionTitles, fetchSession, fetchQuestions } from '../shared'

export function mountWizardSessionOpsRoutes(app: Hono<{ Bindings: Env; Variables: SessionVars }>) {
  // DELETE /api/sessions/:id — hard-delete a session the caller owns
  app.delete('/:id', async (c) => {
    const user = c.get('user')
    const id = c.req.param('id')
    const session = await fetchSession(c.env.DB, id, user.sub)
    if (!session) {
      return c.json(
        { ok: false, error: { code: 'not_found', message: 'Session not found' }, trace_id: c.get('trace_id') },
        404,
      )
    }
    const { deleted } = await hardDeleteSession(c.env.DB, id, user.sub)
    if (!deleted) {
      return c.json(
        { ok: false, error: { code: 'not_found', message: 'Session not found' }, trace_id: c.get('trace_id') },
        404,
      )
    }
    return c.json({ ok: true, trace_id: c.get('trace_id') })
  })

  // POST /api/sessions/:id/duplicate — create a DRAFT copy (optional body.title)
  app.post('/:id/duplicate', async (c) => {
    const user = c.get('user')
    const id = c.req.param('id')
    const quotas = c.get('planQuotas')

    const validated = await validateBody(c, DuplicateSessionSchema)
    if ('error' in validated) {
      return validated.error
    }
    const { data: body } = validated

    const session = await fetchSession(c.env.DB, id, user.sub)
    if (!session) {
      return c.json(
        { ok: false, error: { code: 'not_found', message: 'Session not found' }, trace_id: c.get('trace_id') },
        404,
      )
    }

    const { allowed } = await incrementSessionQuota(c.env.SESSIONS_KV, user.sub, quotas.maxSessionsPerMonth)
    if (!allowed) {
      return c.json(
        { ok: false, error: { code: 'quota_exceeded', message: 'Session quota exceeded' }, trace_id: c.get('trace_id') },
        429,
      )
    }

    const existingTitles = await fetchOwnerSessionTitles(c.env.DB, user.sub)
    const title =
      body.title ?? suggestDuplicateTitle(session.title, existingTitles)

    const newId = ulid()
    const code = generateJoinCode()
    const now = Date.now()

    let duplicateTeamId: string | null = (session as { team_id?: string | null }).team_id ?? null
    if (!duplicateTeamId) {
      try {
        const personal = await ensurePersonalTeam(c.env.TEAMS_KV, c.env.DB, user.sub, user.email)
        duplicateTeamId = personal.id
      } catch {
        duplicateTeamId = null
      }
    }

    await c.env.DB
      .prepare(
        `INSERT INTO sessions (id, owner_id, code, title, status, anonymity, vote_policy, session_mode, created_at, team_id)
         VALUES (?1, ?2, ?3, ?4, 'draft', ?5, ?6, ?7, ?8, ?9)`,
      )
      .bind(newId, user.sub, code, title, session.anonymity, session.vote_policy, session.session_mode, now, duplicateTeamId)
      .run()

    const questions = await fetchQuestions(c.env.DB, id)
    for (const q of questions) {
      const qid = ulid()
      await c.env.DB
        .prepare(
          `INSERT INTO questions (id, session_id, position, kind, prompt, options_json, created_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
        )
        .bind(qid, newId, q.position, q.kind, q.prompt, JSON.stringify(q.options), now)
        .run()
    }

    const newSession: Session = {
      id: newId,
      owner_id: user.sub,
      code,
      title,
      status: 'draft',
      anonymity: session.anonymity,
      vote_policy: session.vote_policy,
      session_mode: session.session_mode,
      created_at: now,
      started_at: null,
      closed_at: null,
      archived_at: null,
      team_id: duplicateTeamId,
    }
    const newQuestions = await fetchQuestions(c.env.DB, newId)
    return c.json(
      { ok: true, data: { session: newSession, questions: newQuestions }, trace_id: c.get('trace_id') },
      201,
    )
  })

  // (Former GET /api/sessions/:id/export.csv handler removed —
  //  superseded by the team-gated rich CSV defined above as part of
  //  EXPORT-RICH-01-A. See v2.2 audit outcomes.)
}
