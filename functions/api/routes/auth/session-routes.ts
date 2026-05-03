import { deleteCookie } from 'hono/cookie'
import { authMiddleware, SESSION_COOKIE } from '../../middleware/auth'
import type { AuthApp } from './types'

export function registerAuthSessionRoutes(app: AuthApp): void {
  app.get('/me', authMiddleware, (c) => {
    const user = c.get('user')
    return c.json({ ok: true, data: { id: user.sub, email: user.email }, trace_id: c.get('trace_id') })
  })

  app.post('/logout', (c) => {
    deleteCookie(c, SESSION_COOKIE, { path: '/' })
    return c.json({ ok: true, data: { cleared: true }, trace_id: c.get('trace_id') })
  })
}
