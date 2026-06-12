/**
 * EMBED-WIDGET-API-01 (ADR-0050) — public read-plane gate for `/api/embed/v1/*`.
 *
 * Validates the origin-bound widget token on EVERY call:
 *   1. signature + version + scope + TTL (lib/embed-token.ts, single shared HMAC)
 *   2. Origin header ∈ token.ao  → reflected-allowlist CORS, never `*`
 *   3. revocation: the wid row's revoked_at overrides a still-unexpired exp
 *
 * On success it sets `c.get('widget')` (the verified claims) and the reflected
 * CORS headers, then calls next(). The widget API itself does NOT re-check the
 * plan — a validly-signed, unexpired, origin-matching, un-revoked token IS proof
 * the Team-tier mint gate passed (ADR-0050 §4), keeping the read path one HMAC
 * verify + one indexed revocation read.
 */
import type { Context, Next } from 'hono'
import type { Env, EmbedWidgetTokenClaims } from '../types'
import { verifyEmbedToken, originAllowed, normaliseOrigin } from '../lib/embed-token'
import { fetchEmbedWidgetById } from '../repositories/embedWidgetRepository'

export type WidgetVars = { widget: EmbedWidgetTokenClaims }

/** Bearer first, then `?wt=` query fallback (cross-origin GET without a custom header). */
function extractToken(c: Context): string | null {
  const auth = c.req.header('authorization')
  if (auth?.startsWith('Bearer ')) return auth.slice(7).trim()
  const q = c.req.query('wt')
  return q && q.length > 0 ? q : null
}

function deny(c: Context, status: 401 | 403, code: string, message: string) {
  return c.json({ ok: false, error: { code, message }, trace_id: c.get('trace_id') ?? 'unknown' }, status)
}

export async function widgetTokenMiddleware(
  c: Context<{ Bindings: Env; Variables: WidgetVars & { trace_id?: string } }>,
  next: Next,
) {
  // Vary: Origin on every response (cacheability correctness for the reflected
  // allowlist) — set before any early return.
  c.header('Vary', 'Origin')

  const secret = c.env.EMBED_WIDGET_SECRET
  if (!secret) {
    return c.json(
      { ok: false, error: { code: 'unavailable', message: 'Embed widgets not configured' }, trace_id: c.get('trace_id') ?? 'unknown' },
      503,
    )
  }

  const token = extractToken(c)
  if (!token) return deny(c, 401, 'unauthenticated', 'Widget token required')

  const verified = await verifyEmbedToken(secret, token)
  if (!verified.ok) {
    const code = verified.reason === 'expired' ? 'token_expired' : 'invalid_token'
    return deny(c, 401, code, `Widget token ${verified.reason}`)
  }
  const claims = verified.claims

  // Origin pin — the control that makes a stolen token non-replayable cross-origin.
  const origin = c.req.header('origin')
  if (!originAllowed(claims, origin)) {
    return deny(c, 403, 'origin_not_allowed', 'Origin not permitted for this widget token')
  }

  // Revocation kill-switch — one indexed D1 read; overrides a still-valid exp.
  const widget = await fetchEmbedWidgetById(c.env.DB, claims.wid)
  if (!widget || widget.revoked_at !== null) {
    return deny(c, 401, 'token_revoked', 'Widget token has been revoked')
  }

  // Reflected-allowlist CORS — echo the request Origin ONLY because it is in
  // `ao` (checked above), never `*`.
  const normOrigin = normaliseOrigin(origin)
  if (normOrigin) c.header('Access-Control-Allow-Origin', normOrigin)

  c.set('widget', claims)
  await next()
}
