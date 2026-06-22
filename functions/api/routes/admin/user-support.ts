// Platformbeheer — Module 3: Gebruikers (support + account management).
//
// Support actions on end-user accounts, all server-side admin-gated and all
// audited. Companion to admin/users.ts (which owns list/create/patch/suspend);
// this file adds the detail aggregation and the privileged, must-be-audited
// actions: impersonation, GDPR export, and GDPR deletion across all three
// privacy layers (content + metadata + vector index).

import { Hono } from 'hono'
import { z } from 'zod'
import { setCookie, deleteCookie } from 'hono/cookie'
import { authMiddleware, IMPERSONATION_COOKIE, type AuthVariables } from '../../middleware/auth'
import { adminMiddleware, type AdminVariables } from '../../middleware/admin'
import { rateLimit } from '../../middleware/rate-limit'
import { ulid } from '../../lib/ulid'
import { signJwt } from '../../lib/jwt'
import { validateBody } from '../../lib/request-validation'
import { recordAuditEvent } from '../../lib/audit'
import { deleteUserGdprData } from '../../lib/gdpr-delete-user'
import type { Env } from '../../types'

// Short-lived: impersonation should be just long enough to reproduce an issue,
// not a standing credential.
const IMPERSONATION_TTL_SECONDS = 15 * 60

type UserRow = {
  id: string
  email: string
  display_name: string | null
  plan: 'free' | 'starter' | 'team'
  created_at: number
  last_login_at: number | null
  suspended_at: number | null
  stripe_customer_id: string | null
  admin_role: 'admin' | null
}

export function mountUserSupportRoutes(
  app: Hono<{ Bindings: Env; Variables: AuthVariables & AdminVariables }>,
) {
  // ── GET /users/:id/detail ──────────────────────────────────────────────────
  // One round-trip of parallel queries — no N+1.
  app.get('/users/:id/detail', authMiddleware, adminMiddleware, async (c) => {
    const trace_id = c.get('trace_id')
    const userId = c.req.param('id')

    const [user, sessionAgg, recentSessions, auditEvents] = await Promise.all([
      c.env.DB.prepare(
        `SELECT u.id, u.email, u.display_name, u.plan, u.created_at, u.last_login_at, u.suspended_at,
                u.stripe_customer_id,
                CASE WHEN pr.role IS NOT NULL THEN 'admin' ELSE NULL END AS admin_role
         FROM users u
         LEFT JOIN platform_roles pr ON pr.user_id = u.id AND pr.role = 'platform_admin'
         WHERE u.id = ?1`,
      )
        .bind(userId)
        .first<UserRow>(),
      c.env.DB.prepare(
        `SELECT
           COUNT(*) AS total,
           COALESCE(SUM(CASE WHEN status = 'live' THEN 1 ELSE 0 END), 0) AS live,
           COALESCE(SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END), 0) AS closed,
           COALESCE(SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END), 0) AS draft,
           COALESCE(SUM(CASE WHEN status = 'archived' THEN 1 ELSE 0 END), 0) AS archived
         FROM sessions WHERE owner_id = ?1`,
      )
        .bind(userId)
        .first<{ total: number; live: number; closed: number; draft: number; archived: number }>()
        .catch(() => null),
      c.env.DB.prepare(
        `SELECT id, title, status, created_at FROM sessions WHERE owner_id = ?1 ORDER BY created_at DESC LIMIT 10`,
      )
        .bind(userId)
        .all<{ id: string; title: string; status: string; created_at: number }>()
        .catch(() => ({ results: [] })),
      c.env.DB.prepare(
        `SELECT ts, action, actor_id, subject_type, subject_id, trace_id
         FROM audit_events
         WHERE subject_id = ?1 OR actor_id = ?1
         ORDER BY ts DESC LIMIT 25`,
      )
        .bind(userId)
        .all<{ ts: number; action: string; actor_id: string | null; subject_type: string | null; subject_id: string | null; trace_id: string | null }>()
        .catch(() => ({ results: [] })),
    ])

    if (!user) {
      return c.json({ ok: false, error: { code: 'not_found', message: 'User not found' }, trace_id }, 404)
    }

    return c.json(
      {
        ok: true,
        data: {
          account: {
            id: user.id,
            email: user.email,
            display_name: user.display_name,
            created_at: user.created_at,
            last_login_at: user.last_login_at,
            suspended_at: user.suspended_at,
            // 'admin' = platform admin; otherwise the account hosts/participates
            // (host vs participant is per-session, not a stored global role).
            role: user.admin_role ?? 'host',
          },
          subscription: {
            plan: user.plan,
            stripe_customer_id: user.stripe_customer_id,
            has_stripe: Boolean(user.stripe_customer_id),
            // Live Stripe sync (next billing date, payment history) is a
            // separate on-demand action — not fetched on every detail load.
            live_sync_available: Boolean(user.stripe_customer_id),
          },
          activity: {
            hosted_sessions: sessionAgg ?? { total: 0, live: 0, closed: 0, draft: 0, archived: 0 },
            recent_sessions: recentSessions.results ?? [],
            // Joined/participated sessions are not tracked per-user in a durable
            // table (anonymity-by-default); surfaced as null rather than faked.
            joined_sessions: null,
          },
          audit_trail: auditEvents.results ?? [],
        },
        trace_id,
      },
      200,
    )
  })

  // ── POST /users/:id/impersonate ────────────────────────────────────────────
  // Sets a short-TTL impersonation cookie (preferred by authMiddleware over the
  // admin's own session) so the admin's subsequent requests resolve as the
  // target user. The admin's real session cookie is left untouched, so "stop"
  // restores it without re-login. The jti encodes the acting admin for
  // downstream traceability, and a user.impersonate event is written first — if
  // the audit write fails, no cookie is issued.
  app.post('/users/:id/impersonate', rateLimit({ namespace: 'admin-destructive', limit: 10, windowSec: 600 }), authMiddleware, adminMiddleware, async (c) => {
    const trace_id = c.get('trace_id')
    const actor = c.get('user')
    const userId = c.req.param('id')

    if (userId === actor?.sub) {
      return c.json({ ok: false, error: { code: 'bad_request', message: 'Cannot impersonate yourself' }, trace_id }, 400)
    }

    const target = await c.env.DB.prepare(
      `SELECT id, email, display_name FROM users WHERE id = ?1`,
    )
      .bind(userId)
      .first<{ id: string; email: string; display_name: string | null }>()
    if (!target) {
      return c.json({ ok: false, error: { code: 'not_found', message: 'User not found' }, trace_id }, 404)
    }

    const jti = `imp:${actor?.sub ?? 'unknown'}:${ulid()}`

    await recordAuditEvent(c, {
      action: 'user.impersonate',
      subject_type: 'user',
      subject_id: userId,
      after_snapshot: { impersonated_email: target.email, jti, ttl_seconds: IMPERSONATION_TTL_SECONDS },
      trace_id,
    })

    const token = await signJwt({ sub: target.id, email: target.email, jti }, c.env.JWT_SECRET, IMPERSONATION_TTL_SECONDS)

    // HttpOnly impersonation cookie — the credential. The SPA learns it's
    // impersonating from /api/auth/me (cross-origin safe), not from JS cookies.
    setCookie(c, IMPERSONATION_COOKIE, token, {
      httpOnly: true,
      secure: true,
      sameSite: 'None',
      path: '/',
      maxAge: IMPERSONATION_TTL_SECONDS,
    })

    return c.json(
      {
        ok: true,
        data: {
          expires_in: IMPERSONATION_TTL_SECONDS,
          impersonating: { id: target.id, email: target.email, display_name: target.display_name },
          actor_id: actor?.sub ?? null,
        },
        trace_id,
      },
      200,
    )
  })

  // ── POST /impersonation/stop ───────────────────────────────────────────────
  // Auth-only (NOT admin-gated): while impersonating, the session resolves as
  // the non-admin target, so this must be callable by them. Clearing the
  // impersonation cookie restores the admin's untouched session.
  app.post('/impersonation/stop', authMiddleware, async (c) => {
    const trace_id = c.get('trace_id')
    const impersonatorId = c.get('impersonator_id')
    deleteCookie(c, IMPERSONATION_COOKIE, { path: '/' })
    if (impersonatorId) {
      // Record the end of the session under the real admin actor.
      await recordAuditEvent(c, {
        action: 'user.impersonate_stop',
        subject_type: 'user',
        subject_id: c.get('user')?.sub ?? 'unknown',
        actor_id: impersonatorId,
        trace_id,
      })
    }
    return c.json({ ok: true, data: { stopped: true }, trace_id }, 200)
  })

  // ── GET /users/:id/gdpr-export ─────────────────────────────────────────────
  app.get('/users/:id/gdpr-export', authMiddleware, adminMiddleware, async (c) => {
    const trace_id = c.get('trace_id')
    const userId = c.req.param('id')

    const profile = await c.env.DB.prepare(
      `SELECT id, email, display_name, plan, created_at, last_login_at FROM users WHERE id = ?1`,
    )
      .bind(userId)
      .first()
    if (!profile) {
      return c.json({ ok: false, error: { code: 'not_found', message: 'User not found' }, trace_id }, 404)
    }
    const sessions = await c.env.DB.prepare(
      `SELECT id, title, status, created_at, closed_at FROM sessions WHERE owner_id = ?1 ORDER BY created_at DESC LIMIT 1000`,
    )
      .bind(userId)
      .all()

    await recordAuditEvent(c, {
      action: 'user.gdpr_export',
      subject_type: 'user',
      subject_id: userId,
      trace_id,
    })

    const payload = {
      exportedAt: Date.now(),
      format: 'json-portability-v1',
      exportedBy: c.get('user')?.sub ?? null,
      profile,
      sessions: sessions.results ?? [],
      note: 'Admin-initiated GDPR portability export. Vote-level PII omitted under team anonymity modes.',
    }

    return new Response(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'content-disposition': `attachment; filename="qesto-user-${userId}-export.json"`,
        'x-trace-id': trace_id,
      },
    })
  })

  // ── POST /users/:id/gdpr-delete ────────────────────────────────────────────
  // Three-layer deletion (content + metadata + DECISIONS_VECTORIZE). Requires an
  // explicit confirm flag; the destructive confirmation UX lives client-side.
  const DeleteSchema = z.object({ confirm: z.literal(true) })
  app.post('/users/:id/gdpr-delete', rateLimit({ namespace: 'admin-destructive', limit: 10, windowSec: 600 }), authMiddleware, adminMiddleware, async (c) => {
    const trace_id = c.get('trace_id')
    const actor = c.get('user')
    const userId = c.req.param('id')

    const validated = await validateBody(c, DeleteSchema)
    if ('error' in validated) return validated.error

    if (userId === actor?.sub) {
      return c.json(
        { ok: false, error: { code: 'bad_request', message: 'Use self-service deletion for your own account' }, trace_id },
        400,
      )
    }

    const exists = await c.env.DB.prepare(`SELECT id FROM users WHERE id = ?1`).bind(userId).first()
    if (!exists) {
      return c.json({ ok: false, error: { code: 'not_found', message: 'User not found' }, trace_id }, 404)
    }

    const result = await deleteUserGdprData(
      {
        DB: c.env.DB,
        USERS_KV: c.env.USERS_KV,
        TEAMS_KV: c.env.TEAMS_KV,
        SESSIONS_KV: c.env.SESSIONS_KV,
        DECISIONS_VECTORIZE: c.env.DECISIONS_VECTORIZE,
      },
      userId,
    )

    await recordAuditEvent(c, {
      action: 'user.gdpr_delete',
      subject_type: 'user',
      subject_id: userId,
      after_snapshot: {
        sessions_deleted: result.sessionsDeleted,
        vectors_deleted: result.vectorsDeleted,
        user_row_deleted: result.userRowDeleted,
      },
      trace_id,
    })

    return c.json({ ok: true, data: result, trace_id }, 200)
  })
}
