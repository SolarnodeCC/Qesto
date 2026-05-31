import { Hono } from 'hono'
import { authMiddleware, type AuthVariables } from '../middleware/auth'
import type { PlanVariables } from '../middleware/plan'
import type { AdminVariables } from '../middleware/admin'
import type { RbacVariables } from '../middleware/rbac'
import { writeEvent } from '../lib/observability'
import { deleteUserGdprData } from '../lib/gdpr-delete-user'
import { recordAuthAuditEvent } from '../lib/audit'
import { ok } from '../lib/http'
import type { Env } from '../types'

// Match the Vars shape used in app.ts so this sub-router composes cleanly.
type Vars = AuthVariables & PlanVariables & Partial<AdminVariables> & Partial<RbacVariables>

export function mountGdprRoutes(parent: Hono<{ Bindings: Env; Variables: Vars }>) {
  const app = new Hono<{ Bindings: Env; Variables: Vars }>()

  app.delete('/me/gdpr-delete', authMiddleware, async (c) => {
    const user = c.get('user')
    const traceId = c.get('trace_id')

    writeEvent(c.env.METRICS_AE, {
      name: 'gdpr.deletion_requested',
      userId: user.sub,
      traceId,
    })

    const result = await deleteUserGdprData(
      {
        DB: c.env.DB,
        USERS_KV: c.env.USERS_KV,
        TEAMS_KV: c.env.TEAMS_KV,
        SESSIONS_KV: c.env.SESSIONS_KV,
      },
      user.sub,
    )

    writeEvent(c.env.METRICS_AE, {
      name: 'gdpr.deletion_completed',
      userId: user.sub,
      traceId,
      count: result.sessionsDeleted,
    })

    return ok(c, {
      deleted: true,
      sessionsDeleted: result.sessionsDeleted,
      userRowDeleted: result.userRowDeleted,
    })
  })

  app.get('/me/data-export', authMiddleware, async (c) => {
    const user = c.get('user')
    const sessions = await c.env.DB.prepare(
      `SELECT id, title, status, created_at, closed_at FROM sessions WHERE owner_id = ?1 ORDER BY created_at DESC LIMIT 500`,
    )
      .bind(user.sub)
      .all()
    const profile = await c.env.DB.prepare(`SELECT id, email, created_at FROM users WHERE id = ?1`)
      .bind(user.sub)
      .first()
    return ok(c, {
      exportedAt: Date.now(),
      format: 'json-portability-v1',
      profile: profile ?? { id: user.sub, email: user.email },
      sessions: sessions.results ?? [],
      note: 'Machine-readable GDPR portability export; does not include vote-level PII for team anonymity modes.',
    })
  })

  /**
   * ENTERPRISE-POLISH §9a — Org-admin GDPR deletion (Art. 17 self-service).
   *
   * POST /api/teams/:teamId/members/:userId/gdpr-delete
   *   - Team owner only (checks owner_id on team row).
   *   - Deletes all personal data for the target member.
   *   - Writes audit trail entry + AE event.
   *   - Returns deletion summary; does NOT expose internal error detail.
   */
  app.post('/teams/:teamId/members/:userId/gdpr-delete', authMiddleware, async (c) => {
    const actor = c.get('user')
    const { teamId, userId: targetUserId } = c.req.param()
    const traceId = c.get('trace_id')

    // Verify actor is owner of the team
    const team = await c.env.DB.prepare(
      `SELECT owner_id FROM teams WHERE id = ?1`,
    ).bind(teamId).first<{ owner_id: string }>()

    if (!team) {
      return c.json({ ok: false, error: { code: 'not_found', message: 'Team not found' }, trace_id: traceId }, 404)
    }
    if (team.owner_id !== actor.sub) {
      void recordAuthAuditEvent(c.env.DB, {
        action: 'auth.gdpr_deletion',
        actor_id: actor.sub,
        actor_ip: c.req.header('cf-connecting-ip') ?? null,
        trace_id: traceId,
        subject_id: targetUserId,
        outcome: 'failure',
        detail: 'forbidden_not_owner',
      })
      return c.json({ ok: false, error: { code: 'forbidden', message: 'Only the team owner can request member deletion' }, trace_id: traceId }, 403)
    }

    // Prevent owners from deleting themselves via this route (use /me/gdpr-delete)
    if (targetUserId === actor.sub) {
      return c.json({ ok: false, error: { code: 'bad_request', message: 'Use /api/users/me/gdpr-delete to delete your own account' }, trace_id: traceId }, 400)
    }

    // Verify target is actually a member of this team
    const membership = await c.env.DB.prepare(
      `SELECT 1 FROM team_members WHERE team_id = ?1 AND user_id = ?2`,
    ).bind(teamId, targetUserId).first()

    if (!membership) {
      return c.json({ ok: false, error: { code: 'not_found', message: 'User is not a member of this team' }, trace_id: traceId }, 404)
    }

    writeEvent(c.env.METRICS_AE, {
      name: 'gdpr.deletion_requested',
      userId: targetUserId,
      teamId,
      traceId,
    })

    const result = await deleteUserGdprData(
      {
        DB: c.env.DB,
        USERS_KV: c.env.USERS_KV,
        TEAMS_KV: c.env.TEAMS_KV,
        SESSIONS_KV: c.env.SESSIONS_KV,
      },
      targetUserId,
    )

    void recordAuthAuditEvent(c.env.DB, {
      action: 'auth.gdpr_deletion',
      actor_id: actor.sub,
      actor_ip: c.req.header('cf-connecting-ip') ?? null,
      trace_id: traceId,
      subject_id: targetUserId,
      outcome: 'success',
      detail: `sessions_deleted:${result.sessionsDeleted}`,
    })

    writeEvent(c.env.METRICS_AE, {
      name: 'gdpr.deletion_completed',
      userId: targetUserId,
      teamId,
      traceId,
      count: result.sessionsDeleted,
    })

    return ok(c, {
      deleted: true,
      sessionsDeleted: result.sessionsDeleted,
      userRowDeleted: result.userRowDeleted,
    })
  })

  parent.route('/api/users', app)
  parent.route('/api', app)
}
