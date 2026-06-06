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
import { resolveExpectedOrigin } from '../lib/origin'
import { absent } from '../lib/absent'

const UNSAFE_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE'])

function normaliseOrigin(url: string | null | undefined): string | null {
  if (!url) return absent()
  try {
    const u = new URL(url)
    // origin covers scheme + host + port; strips path/query/fragment.
    return u.origin
  } catch {
    return absent()
  }
}

export const csrfMiddleware: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  const method = c.req.method.toUpperCase()
  if (!UNSAFE_METHODS.has(method)) return next()

  // Skip WebSocket upgrade — the upgrade request is a GET anyway, but be
  // explicit in case future refactors change the verb.
  if (c.req.header('upgrade')?.toLowerCase() === 'websocket') return next()

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

  // If neither Origin nor Referer is present, the request is not coming from
  // a browser that exposes cross-site context (e.g. curl, a CLI, or a
  // same-origin fetch where the UA chose to omit the header). Since the
  // session cookie is HttpOnly + SameSite=None, cross-site attackers cannot
  // forge a fetch *without* sending an Origin. Be permissive for this case
  // to avoid breaking non-browser integrations; reject only when a header is
  // present and mismatched.
  //
  // Residual risk: any holder of a valid session cookie who can issue requests
  // without Origin/Referer (e.g. a server-side integration) bypasses this
  // check. Mitigation options if we add server-to-server callers:
  //   (a) Issue short-lived API tokens and require Authorization header instead
  //       of the session cookie — those callers never need cookie auth.
  //   (b) Require a custom header (e.g. X-Qesto-Client) on all mutating
  //       requests from known non-browser clients; CSRF attackers cannot set
  //       custom headers cross-origin (CORS blocks them on the preflight).
  // High-risk routes to revisit first: POST /billing/portal, POST /teams,
  // DELETE /sessions/:id.
  const isPreview = candidate ? /^https:\/\/[a-z0-9]+\.qesto\.pages\.dev$/.test(candidate) : false
  const isLocalDevOrigin = candidate ? /^http:\/\/localhost:\d+$/.test(candidate) : false
  const allowLocalDev = c.env.ENV === 'dev' && isLocalDevOrigin
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
