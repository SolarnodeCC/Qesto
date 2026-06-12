/**
 * EMBED-WIDGET-API-01 (ADR-0050) — authenticated widget MINT plane.
 *
 * A Team-tier host registers an embed_widgets config (session + allowed origins)
 * and mints short-lived, origin-bound widget tokens the SDK ships to a public
 * page. The `embedWidgets` entitlement is enforced HERE (mint time) only; the
 * public read plane trusts a valid token (ADR-0050 §4).
 *
 *   POST   /api/embed/widgets            — create a config
 *   GET    /api/embed/widgets            — list the team's configs
 *   POST   /api/embed/widgets/:wid/token — mint a token { origins[], ttl? } → { token, exp }
 *   DELETE /api/embed/widgets/:wid       — revoke (set revoked_at)
 */
import { Hono, type Context } from 'hono'
import { z } from 'zod'
import { authMiddleware, type AuthVariables } from '../middleware/auth'
import { planMiddleware, type PlanVariables } from '../middleware/plan'
import { featureAllowed, denyFeature } from '../lib/entitlements'
import { fetchSession } from './sessions/shared'
import { recordAuditEvent } from '../lib/audit'
import { signEmbedToken, normaliseOrigin } from '../lib/embed-token'
import {
  insertEmbedWidget,
  listEmbedWidgetsForTeam,
  fetchEmbedWidgetForTeam,
  revokeEmbedWidget,
} from '../repositories/embedWidgetRepository'
import { ulid } from '../lib/ulid'
import type { Env, EmbedWidget } from '../types'
import type { ParentApp } from './parent-app'

type Vars = AuthVariables & PlanVariables

// An exact origin string (scheme://host[:port]); normalised + de-duped server-side.
const OriginSchema = z.string().min(1).max(253)

const CreateWidgetSchema = z
  .object({
    session_id: z.string().min(1).optional(),
    code: z.string().min(1).optional(),
    allowed_origins: z.array(OriginSchema).min(1).max(20),
  })
  .refine((d) => !!d.session_id || !!d.code, { message: 'session_id or code is required' })

const MintTokenSchema = z.object({
  origins: z.array(OriginSchema).min(1).max(20),
  ttl: z.number().int().positive().optional(),
})

/**
 * Resolve the caller's tenant id for the embed_widgets.team_id binding. The
 * session JWT carries only `sub`/`email` (no team claim), and the embed surface
 * authorises the session by ownership (`owner_id = user.sub`), so the host's
 * user id is the tenant key here — consistent with the session-ownership model
 * used across the DRAFT REST surface.
 */
function callerTeamId(c: Context<{ Bindings: Env; Variables: Vars }>): string {
  return c.get('user').sub
}

export function mountEmbedRoutes(parent: ParentApp) {
  const app = new Hono<{ Bindings: Env; Variables: Vars }>()
  app.use('*', authMiddleware)
  app.use('*', planMiddleware)

  // Single entitlement gate for the whole mint plane (ADR-0050 §4).
  app.use('*', async (c, next) => {
    if (!featureAllowed(c.get('planQuotas'), 'embedWidgets')) {
      return c.json({ ok: false, error: denyFeature(c.get('plan'), 'embedWidgets'), trace_id: c.get('trace_id') }, 403)
    }
    await next()
  })

  // ── Create a widget config ──────────────────────────────────────────────────
  app.post('/widgets', async (c) => {
    const trace_id = c.get('trace_id')
    const user = c.get('user')
    const parsed = CreateWidgetSchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) {
      return c.json({ ok: false, error: { code: 'validation', message: 'Invalid widget config' }, trace_id }, 400)
    }

    // Resolve + authorise the session: the host must own it.
    const session = await fetchSession(c.env.DB, parsed.data.session_id ?? parsed.data.code ?? '', user.sub)
    // session_id path: fetchSession matches on id; code path needs a code lookup.
    const resolved =
      session ?? (parsed.data.code ? await fetchOwnedSessionByCode(c.env.DB, parsed.data.code, user.sub) : null)
    if (!resolved) {
      return c.json({ ok: false, error: { code: 'not_found', message: 'Session not found' }, trace_id }, 404)
    }

    // Normalise + de-dupe origins; reject if none survive normalisation.
    const origins = normaliseOriginList(parsed.data.allowed_origins)
    if (origins.length === 0) {
      return c.json({ ok: false, error: { code: 'validation', message: 'No valid origins' }, trace_id }, 400)
    }

    const widget: EmbedWidget = {
      id: ulid(),
      team_id: callerTeamId(c),
      session_id: resolved.id,
      session_code: resolved.code,
      allowed_origins: origins,
      scope: 'read',
      created_by: user.sub,
      created_at: Date.now(),
      revoked_at: null,
    }
    await insertEmbedWidget(c.env.DB, widget)

    await recordAuditEvent(c, {
      action: 'embed.widget.create',
      subject_type: 'embed_widget',
      subject_id: widget.id,
      after_snapshot: { session_id: widget.session_id, allowed_origins: origins },
    })

    return c.json({ ok: true, data: { widget }, trace_id }, 201)
  })

  // ── List the team's widget configs ──────────────────────────────────────────
  app.get('/widgets', async (c) => {
    const widgets = await listEmbedWidgetsForTeam(c.env.DB, callerTeamId(c))
    return c.json({ ok: true, data: { widgets }, trace_id: c.get('trace_id') })
  })

  // ── Mint a short-lived, origin-bound token ──────────────────────────────────
  app.post('/widgets/:wid/token', async (c) => {
    const trace_id = c.get('trace_id')
    const wid = c.req.param('wid')
    const parsed = MintTokenSchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) {
      return c.json({ ok: false, error: { code: 'validation', message: 'Invalid mint request' }, trace_id }, 400)
    }

    const secret = c.env.EMBED_WIDGET_SECRET
    if (!secret) {
      return c.json({ ok: false, error: { code: 'unavailable', message: 'Embed widgets not configured' }, trace_id }, 503)
    }

    const widget = await fetchEmbedWidgetForTeam(c.env.DB, wid, callerTeamId(c))
    if (!widget) {
      return c.json({ ok: false, error: { code: 'not_found', message: 'Widget not found' }, trace_id }, 404)
    }
    if (widget.revoked_at !== null) {
      return c.json({ ok: false, error: { code: 'revoked', message: 'Widget has been revoked' }, trace_id }, 409)
    }

    // Requested origins MUST be a subset of the row's registered allowlist.
    const requested = normaliseOriginList(parsed.data.origins)
    const allowed = new Set(widget.allowed_origins)
    const subset = requested.filter((o) => allowed.has(o))
    if (subset.length === 0 || subset.length !== requested.length) {
      return c.json(
        { ok: false, error: { code: 'origin_not_registered', message: 'Origins must be a subset of the widget allowlist' }, trace_id },
        400,
      )
    }

    const { token, exp } = await signEmbedToken(secret, {
      wid: widget.id,
      sid: widget.session_id,
      code: widget.session_code,
      tid: widget.team_id,
      ao: subset,
      ...(parsed.data.ttl !== undefined ? { ttl: parsed.data.ttl } : {}),
    })

    await recordAuditEvent(c, {
      action: 'embed.widget.token_mint',
      subject_type: 'embed_widget',
      subject_id: widget.id,
      after_snapshot: { exp, origins: subset }, // no token material in the audit log
    })

    return c.json({ ok: true, data: { token, exp }, trace_id })
  })

  // ── Revoke (immediate kill-switch) ──────────────────────────────────────────
  app.delete('/widgets/:wid', async (c) => {
    const trace_id = c.get('trace_id')
    const wid = c.req.param('wid')
    const revoked = await revokeEmbedWidget(c.env.DB, wid, callerTeamId(c), Date.now())
    if (!revoked) {
      return c.json({ ok: false, error: { code: 'not_found', message: 'Widget not found or already revoked' }, trace_id }, 404)
    }

    await recordAuditEvent(c, {
      action: 'embed.widget.revoke',
      subject_type: 'embed_widget',
      subject_id: wid,
      after_snapshot: { revoked: true },
    })

    return c.json({ ok: true, data: { revoked: true }, trace_id })
  })

  parent.route('/api/embed', app)
}

/** Normalise + de-dupe a raw origin list, dropping anything that fails URL parsing. */
function normaliseOriginList(raw: string[]): string[] {
  return Array.from(new Set(raw.map((o) => normaliseOrigin(o)).filter((o): o is string => !!o)))
}

/** Owner-scoped session lookup by join code (the create endpoint accepts id OR code). */
async function fetchOwnedSessionByCode(
  db: D1Database,
  code: string,
  ownerId: string,
): Promise<{ id: string; code: string } | null> {
  const row = await db
    .prepare(`SELECT id, code FROM sessions WHERE code = ?1 AND owner_id = ?2`)
    .bind(code, ownerId)
    .first<{ id: string; code: string }>()
  return row ?? null
}
