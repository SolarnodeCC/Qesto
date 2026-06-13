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
import { rateLimit } from '../lib/rate-limit'

export type WidgetVars = { widget: EmbedWidgetTokenClaims }

// PEN5-E1 (ADR-0050 §5) — read-plane rate budgets. Polling reads (state/results)
// get a generous per-minute budget sized for a ~2 rps widget; the handshake
// (which allocates a participant token) is rarer and gets a tighter budget so a
// token cannot be turned into a participant-token mint flood. Both are keyed per
// widget id + origin (below) so one tenant's flood never throttles another's.
const EMBED_READ_RATE = { max: 120, windowSeconds: 60 } as const
const EMBED_HANDSHAKE_RATE = { max: 30, windowSeconds: 60 } as const

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
    // PEN5-E4 — collapse all non-expiry failure reasons to an opaque
    // `invalid_token`; do NOT reflect the internal reason enum into the message
    // (no oracle distinguishing malformed / bad_signature / wrong_version /
    // wrong_scope). Expiry stays distinct so clients can re-mint deterministically.
    if (verified.reason === 'expired') return deny(c, 401, 'token_expired', 'Widget token expired')
    return deny(c, 401, 'invalid_token', 'Widget token invalid')
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

  // PEN5-E1 (ADR-0050 §5) — read-plane rate limit. Keyed per widget id + origin
  // so a flood on one widget token cannot exhaust the budget of another tenant's
  // widget (cross-tenant isolation). Runs AFTER token+origin+revocation so the
  // key components (`wid`, origin) are trustworthy. The handshake carries a
  // tighter budget than the aggregate read GETs. Fail-open on KV error
  // (availability) — the checks above are the security boundary; this is an
  // abuse/availability control, consistent with lib/rate-limit.ts.
  const isHandshake = c.req.path.endsWith('/handshake')
  const budget = isHandshake ? EMBED_HANDSHAKE_RATE : EMBED_READ_RATE
  const rl = await rateLimit(c.env.ACTIONS_KV, `${claims.wid}:${normOrigin ?? 'noorigin'}`, {
    prefix: isHandshake ? 'embed-hs' : 'embed-read',
    max: budget.max,
    windowSeconds: budget.windowSeconds,
  })
  c.header('X-RateLimit-Limit', String(budget.max))
  c.header('X-RateLimit-Remaining', String(Math.max(0, rl.remaining)))
  c.header('X-RateLimit-Reset', String(Math.ceil(rl.resetAt / 1000)))
  if (!rl.allowed) {
    const retryAfter = Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000))
    c.header('Retry-After', String(retryAfter))
    return c.json(
      {
        ok: false,
        error: { code: 'rate_limited', message: 'Too many requests', retryAfter },
        trace_id: c.get('trace_id') ?? 'unknown',
      },
      429,
    )
  }

  c.set('widget', claims)
  await next()
}
