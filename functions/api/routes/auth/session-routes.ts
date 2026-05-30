import { deleteCookie } from 'hono/cookie'
import { signJwt } from '../../lib/jwt'
import { hashSessionToken, revokedSessionTokenKey } from '../../lib/session-token'
import { authMiddleware, SESSION_COOKIE } from '../../middleware/auth'
import { townhallEnabled } from '../../realtime'
import { JWT_TTL_SECONDS } from './constants'
import { setAuthSessionCookie } from './cookie'
import type { AuthApp } from './types'

export function registerAuthSessionRoutes(app: AuthApp): void {
  app.get('/me', authMiddleware, (c) => {
    const user = c.get('user')
    return c.json({
      ok: true,
      data: { id: user.sub, email: user.email, townhallEnabled: townhallEnabled(c.env) },
      trace_id: c.get('trace_id'),
    })
  })

  app.post('/logout', async (c) => {
    const token = c.req.header('authorization')?.replace(/^Bearer\s+/i, '') ?? null
    if (token && c.env.ACTIONS_KV) {
      const tokenHash = await hashSessionToken(token)
      await c.env.ACTIONS_KV.put(revokedSessionTokenKey(tokenHash), '1', { expirationTtl: JWT_TTL_SECONDS })
    }
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
      await c.env.ACTIONS_KV.put(revokedSessionTokenKey(tokenHash), '1', { expirationTtl: JWT_TTL_SECONDS })
    }

    return c.json({ ok: true, data: { refreshed: true }, trace_id: c.get('trace_id') })
  })
}
