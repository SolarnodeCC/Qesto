import { deleteCookie } from 'hono/cookie'
import { signJwt } from '../../lib/jwt'
import { hashSessionToken, revokedSessionTokenKey } from '../../lib/session-token'
import { writeKvText } from '../../lib/kv'
import { authMiddleware, SESSION_COOKIE } from '../../middleware/auth'
import { planMiddleware } from '../../middleware/plan'
import { townhallEnabled } from '../../realtime'
import { recordAuthAuditEvent } from '../../lib/audit'
import { JWT_TTL_SECONDS } from './constants'
import { setAuthSessionCookie } from './cookie'
import type { AuthApp } from './types'

export function registerAuthSessionRoutes(app: AuthApp): void {
  app.get('/me', authMiddleware, planMiddleware, (c) => {
    const user = c.get('user')
    // `impersonating` is set by authMiddleware when the request resolves via the
    // impersonation cookie; the SPA uses it to render the global "viewing as X"
    // banner (works cross-origin, unlike a JS-readable cookie).
    const impersonatorId = c.get('impersonator_id')
    return c.json({
      ok: true,
      data: {
        id: user.sub,
        email: user.email,
        plan: c.get('plan'),
        townhallEnabled: townhallEnabled(c.env),
        ...(impersonatorId ? { impersonating: { email: user.email, impersonator_id: impersonatorId } } : {}),
      },
      trace_id: c.get('trace_id'),
    })
  })

  app.post('/logout', async (c) => {
    const token = c.req.header('authorization')?.replace(/^Bearer\s+/i, '') ?? null
    let logoutUserId: string | null = null
    if (token && c.env.ACTIONS_KV) {
      const tokenHash = await hashSessionToken(token)
      await writeKvText(c.env.ACTIONS_KV, revokedSessionTokenKey(tokenHash), '1', { expirationTtl: JWT_TTL_SECONDS })
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
    deleteCookie(c, SESSION_COOKIE, { path: '/' })
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
