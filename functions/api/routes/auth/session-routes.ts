import { deleteCookie, getCookie } from 'hono/cookie'
import { signJwt } from '../../lib/jwt'
import { hashSessionToken, revokedSessionTokenKey } from '../../lib/session-token'
import { writeKvText } from '../../lib/kv'
import { authMiddleware, IMPERSONATION_COOKIE, SESSION_COOKIE } from '../../middleware/auth'
import { planMiddleware } from '../../middleware/plan'
import { townhallEnabled } from '../../realtime'
import { isPlatformAdmin } from '../../lib/platform-admin'
import { recordAuthAuditEvent } from '../../lib/audit'
import { JWT_TTL_SECONDS } from './constants'
import { setAuthSessionCookie } from './cookie'
import type { AuthApp } from './types'

export function registerAuthSessionRoutes(app: AuthApp): void {
  app.get('/me', authMiddleware, planMiddleware, async (c) => {
    const user = c.get('user')
    // `impersonating` is set by authMiddleware when the request resolves via the
    // impersonation cookie; the SPA uses it to render the global "viewing as X"
    // banner (works cross-origin, unlike a JS-readable cookie).
    const impersonatorId = c.get('impersonator_id')
    // Single source of truth for platform-admin authority (#586): the SPA gates
    // the /admin route on this flag, so the page gate and the API gate
    // (adminMiddleware) can never drift apart.
    const isAdmin = await isPlatformAdmin(c.env, user.sub, user.email)
    return c.json({
      ok: true,
      data: {
        id: user.sub,
        email: user.email,
        plan: c.get('plan'),
        isAdmin,
        townhallEnabled: townhallEnabled(c.env),
        ...(impersonatorId ? { impersonating: { email: user.email, impersonator_id: impersonatorId } } : {}),
      },
      trace_id: c.get('trace_id'),
    })
  })

  app.post('/logout', async (c) => {
    // SECURITY: the session cookie — not the Authorization header — is the
    // primary credential (magic-link and SSO logins never populate the SPA's
    // in-memory bearer token). Revoking only the header token made logout a
    // no-op for those sessions: the 14-day JWT stayed valid for anyone holding
    // a copy. Revoke every token presented on the request, and revoke the
    // impersonation cookie too so "stop impersonating" cannot be replayed.
    const headerToken = c.req.header('authorization')?.replace(/^Bearer\s+/i, '') ?? null
    const cookieToken = getCookie(c, SESSION_COOKIE) ?? null
    const impersonationToken = getCookie(c, IMPERSONATION_COOKIE) ?? null
    const tokens = [cookieToken, headerToken, impersonationToken].filter(
      (t): t is string => typeof t === 'string' && t.length > 0,
    )
    const token = cookieToken ?? headerToken
    let logoutUserId: string | null = null
    if (c.env.ACTIONS_KV) {
      await Promise.all(
        Array.from(new Set(tokens)).map(async (t) => {
          const tokenHash = await hashSessionToken(t)
          await writeKvText(c.env.ACTIONS_KV, revokedSessionTokenKey(tokenHash), '1', {
            expirationTtl: JWT_TTL_SECONDS,
          })
        }),
      )
    }
    try {
      // Best-effort: decode sub from JWT for audit trail without full verification
      if (token) {
        const parts = token.split('.')
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
          logoutUserId = typeof payload.sub === 'string' ? payload.sub : null
        }
      }
    } catch { /* ignore decode errors */ }
    void recordAuthAuditEvent(c.env.DB, {
      action: 'auth.logout',
      actor_id: logoutUserId,
      actor_ip: c.req.header('cf-connecting-ip') ?? null,
      trace_id: c.get('trace_id'),
      subject_id: logoutUserId ?? 'anonymous',
      outcome: 'success',
    })
    // The clearing cookie must carry the SAME attributes the session cookie was
    // issued with (`setAuthSessionCookie`). A bare `Path=/; Max-Age=0` is a
    // first-party (SameSite=Lax) cookie, which the browser rejects outright on
    // this cross-site API response — leaving the real cookie in place.
    deleteCookie(c, SESSION_COOKIE, { path: '/', secure: true, sameSite: 'None' })
    deleteCookie(c, IMPERSONATION_COOKIE, { path: '/', secure: true, sameSite: 'None' })
    return c.json({ ok: true, data: { cleared: true }, trace_id: c.get('trace_id') })
  })

  app.post('/refresh', authMiddleware, async (c) => {
    const user = c.get('user')
    const token = c.get('session_token')
    const jwt = await signJwt(
      { sub: user.sub, email: user.email, jti: crypto.randomUUID() },
      c.env.JWT_SECRET,
      JWT_TTL_SECONDS,
    )
    setAuthSessionCookie(c, jwt)

    if (c.env.ACTIONS_KV && token) {
      const tokenHash = await hashSessionToken(token)
      await writeKvText(c.env.ACTIONS_KV, revokedSessionTokenKey(tokenHash), '1', { expirationTtl: JWT_TTL_SECONDS })
    }

    return c.json({ ok: true, data: { refreshed: true }, trace_id: c.get('trace_id') })
  })
}
