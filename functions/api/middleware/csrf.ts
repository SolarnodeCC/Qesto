// CSRF defense-in-depth: validate the Origin header for state-changing,
// cookie-authenticated requests.
//
// The session cookie uses SameSite=None to support cross-origin requests from
// Cloudflare Pages (frontend) to the Worker (API). This means the browser WILL
// send the cookie on cross-site requests, so Origin-header checking is the
// primary CSRF defence. We reject mismatched Origins to mitigate:
//   • CSRF from attacker pages that can trigger credentialed cross-origin fetches
//   • sub-origin / sibling-domain attacks not covered by SameSite=None
//
// Applies to POST / PATCH / PUT / DELETE. GET / HEAD / OPTIONS are skipped
// because they must remain safe and CORS-preflightable.
//
// Scope:
//   • Expects Origin (or falls back to Referer) to match c.env.PAGES_URL exactly
//     (scheme + host + port).
//   • Exempts the WebSocket upgrade path (`/api/sessions/:id/ws`) — browsers
//     do NOT send Origin for same-origin WS upgrades in a cross-site
//     predictable way, and the DO performs its own auth via subprotocol token
//     / cookie after upgrade.
//   • Exempts `/api/auth/callback` — it's a top-level GET redirect from email
//     (not covered here because GET is already skipped, but documented).
//
// The check is cheap (string compare) and happens before route handlers, so
// attacker requests are rejected before any DB/KV work.

import type { MiddlewareHandler } from 'hono'
import type { Env } from '../types'
import { getCookie } from 'hono/cookie'
import { resolveExpectedOrigin } from '../lib/origin'
import { SESSION_COOKIE } from './auth'

const UNSAFE_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE'])

/**
 * DD-24 (#896): marker header the SPA's API client sends on every request.
 * A cross-site page cannot attach it without passing a CORS preflight, which
 * our CORS policy only grants to PAGES_URL — so its presence proves the
 * request came from our own frontend even when Origin/Referer are absent.
 */
export const CLIENT_MARKER_HEADER = 'x-qesto-client'
export const CLIENT_MARKER_VALUE = 'web'

function normaliseOrigin(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    const u = new URL(url)
    // origin covers scheme + host + port; strips path/query/fragment.
    return u.origin
  } catch {
    return null
  }
}

export const csrfMiddleware: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  const method = c.req.method.toUpperCase()
  if (!UNSAFE_METHODS.has(method)) return next()

  // Skip WebSocket upgrade — the upgrade request is a GET anyway, but be
  // explicit in case future refactors change the verb.
  if (c.req.header('upgrade')?.toLowerCase() === 'websocket') return next()

  // EMBED public read plane (ADR-0050): the widget API is DELIBERATELY a
  // cross-origin, token-authenticated surface (no session cookie). CSRF's
  // Origin-must-equal-PAGES_URL model does not apply; its own
  // widgetTokenMiddleware enforces the per-token origin allowlist instead.
  if (new URL(c.req.url).pathname.startsWith('/api/embed/v1/')) return next()

  const expected = resolveExpectedOrigin(c.env, c.req.url)
  if (!expected) {
    // Misconfigured deploy — fail closed.
    return c.json(
      {
        ok: false,
        error: { code: 'misconfigured', message: 'Server origin not configured' },
        trace_id: (c.get('trace_id' as never) as string | undefined) ?? 'unknown',
      },
      500,
    )
  }

  const originHeader = c.req.header('origin')
  const refererHeader = c.req.header('referer')
  const candidate = normaliseOrigin(originHeader) ?? normaliseOrigin(refererHeader)

  // If neither Origin nor Referer is present, the request did not come from a
  // browser fetch/form (browsers send Origin on every unsafe-method request).
  // DD-24 (#896): that used to be accepted unconditionally, so anything holding
  // a session cookie that could suppress both headers bypassed the check.
  // Now a header-less request may ride on the session *cookie* only if it
  // carries the SPA marker header (custom headers cannot be set cross-site
  // without a passed preflight). Bearer / API-key callers never use the cookie
  // and stay unaffected, as do unauthenticated requests (nothing to forge).
  if (!candidate) {
    const usesCookieAuth =
      Boolean(getCookie(c, SESSION_COOKIE)) && !c.req.header('authorization')
    if (usesCookieAuth && c.req.header(CLIENT_MARKER_HEADER) !== CLIENT_MARKER_VALUE) {
      return c.json(
        {
          ok: false,
          error: { code: 'forbidden_origin', message: 'Cross-origin request blocked' },
          trace_id: (c.get('trace_id' as never) as string | undefined) ?? 'unknown',
        },
        403,
      )
    }
    return next()
  }

  const isPreview = candidate ? /^https:\/\/[a-z0-9]+\.qesto\.pages\.dev$/.test(candidate) : false
  const isLocalDevOrigin = candidate ? /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(candidate) : false
  // SECURITY: localhost is a CSRF *attacker* origin against a deployed API, not
  // a dev convenience. The previous condition allowed it whenever PAGES_URL was
  // remote — true on every production deploy — so any page a victim loaded from
  // http://localhost:<port> (a local dev server, an Electron app, a malicious
  // package's preview server) could drive credentialed state-changing requests
  // against production: the session cookie is SameSite=None, and a `text/plain`
  // POST is a CORS "simple request" that never fires a preflight for the CORS
  // layer to reject.
  //
  // The split-stack workflow this was meant to support (Vite on :5173 against a
  // local `wrangler dev` API) is preserved by a rule that cannot be true in
  // production: accept a loopback Origin only when THIS API is itself being
  // served from loopback. A deployed API answers on qesto.cc, so the branch is
  // unreachable there regardless of how ENV is configured — which matters,
  // because wrangler.toml ships `ENV = "production"` and local `wrangler dev`
  // inherits it.
  const apiIsLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(normaliseOrigin(c.req.url) ?? '')
  const allowLocalDev =
    isLocalDevOrigin && (c.env.ENV === 'dev' || c.env.ENV === 'staging' || apiIsLocal)
  if (candidate && candidate !== expected && !isPreview && !allowLocalDev) {
    return c.json(
      {
        ok: false,
        error: { code: 'forbidden_origin', message: 'Cross-origin request blocked' },
        trace_id: (c.get('trace_id' as never) as string | undefined) ?? 'unknown',
      },
      403,
    )
  }

  return next()
}
