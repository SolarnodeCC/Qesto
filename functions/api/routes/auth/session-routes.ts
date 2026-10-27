import { deleteCookie, getCookie } from 'hono/cookie'
import { signJwt } from '../../lib/jwt'
import { bumpSessionEpoch, hashSessionToken, revokedSessionTokenKey } from '../../lib/session-token'
import { errorResponse } from '../../lib/error-handler'
import { writeKvText } from '../../lib/kv'
import { authMiddleware, IMPERSONATION_COOKIE, SESSION_COOKIE } from '../../middleware/auth'
import { endImpersonation } from '../../lib/impersonation'
import { logBestEffort } from '../../lib/log'
import { planMiddleware } from '../../middleware/plan'
import { townhallEnabled } from '../../realtime'
import { isPlatformAdmin } from '../../lib/platform-admin'
import { freeAccessStatus } from '../../lib/free-access'
import { recordAuthAuditEvent } from '../../lib/audit'
import { JWT_TTL_SECONDS, MAGIC_LINK_MAX_PER_EMAIL, MAGIC_LINK_WINDOW_SECONDS } from './constants'
import { isEmailVerified, sendVerificationLink } from '../../lib/email-verification'
import { atomicRateLimitDual } from '../../lib/atomic-rate-limit'
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
    // DD-10: drives the "confirm your email" banner. A lookup failure reports
    // verified so a D1 blip never nags; the server-side gate still fails closed.
    const emailVerified = await isEmailVerified(c.env.DB, user.sub).catch((err) => {
      logBestEffort(err, { traceId: c.get('trace_id') ?? 'unknown', route: '/api/auth/me', operation: 'email.verified_lookup' })
      return true
    })
    return c.json({
      ok: true,
      data: {
        id: user.sub,
        email: user.email,
        plan: c.get('plan'),
        // ADR-0074: the SPA renders the countdown banner and hides upgrade CTAs
        // off this. `plan` above is already the effective tier.
        free_access: freeAccessStatus(c.env),
        isAdmin,
        email_verified: emailVerified,
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
    // DD-23: drop the impersonation registry entry too, not only the token.
    if (impersonationToken) {
      await endImpersonation(c.env, impersonationToken).catch((err) =>
        // Logout must still succeed; the token itself is revoked just below.
        logBestEffort(err, { traceId: c.get('trace_id') ?? 'unknown', route: c.req.path, operation: 'impersonation.end' }),
      )
    }
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

  // DD-10 (#883): re-send the verification link. Same per-email budget as
  // magic-link requests so it cannot be used to mail-bomb an inbox.
  app.post('/verify-email/resend', authMiddleware, async (c) => {
    const user = c.get('user')
    if (c.get('impersonator_id')) {
      return errorResponse(c, 403, 'forbidden', 'Not available while impersonating')
    }
    if (await isEmailVerified(c.env.DB, user.sub)) {
      return c.json({ ok: true, data: { alreadyVerified: true }, trace_id: c.get('trace_id') })
    }
    const gate = await atomicRateLimitDual(c.env, {
      key: `email:${user.email}`,
      burst: 'auth_burst',
      sustained: { max: MAGIC_LINK_MAX_PER_EMAIL, windowSeconds: MAGIC_LINK_WINDOW_SECONDS, prefix: 'auth-verify' },
      profileLabel: 'auth_verify_resend',
    })
    if (!gate.allowed) {
      return errorResponse(c, 429, 'rate_limited', 'Too many requests. Try again later.')
    }
    await sendVerificationLink(c.env, user.email, c.req.header('cf-connecting-ip') ?? null)
    return c.json({ ok: true, data: { sent: true }, trace_id: c.get('trace_id') }, 202)
  })

  // DD-09 follow-up (#882): "sign out of all other devices". Bumps the session
  // epoch — which invalidates every outstanding token for this user at once —
  // then re-issues a cookie for THIS device so the caller stays signed in.
  app.post('/sessions/revoke-others', authMiddleware, async (c) => {
    const user = c.get('user')
    if (c.get('impersonator_id')) {
      return errorResponse(c, 403, 'forbidden', 'Not available while impersonating')
    }
    if (!c.env.ACTIONS_KV) {
      return errorResponse(c, 503, 'unavailable', 'Session store unavailable')
    }
    await bumpSessionEpoch(c.env, user.sub, JWT_TTL_SECONDS)
    const jwt = await signJwt(
      { sub: user.sub, email: user.email, jti: crypto.randomUUID() },
      c.env.JWT_SECRET,
      JWT_TTL_SECONDS,
    )
    setAuthSessionCookie(c, jwt)
    void recordAuthAuditEvent(c.env.DB, {
      action: 'auth.sessions_revoked',
      actor_id: user.sub,
      actor_ip: c.req.header('cf-connecting-ip') ?? null,
      trace_id: c.get('trace_id'),
      subject_id: user.sub,
      outcome: 'success',
    })
    return c.json({ ok: true, data: { revoked: true, token: jwt }, trace_id: c.get('trace_id') })
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
