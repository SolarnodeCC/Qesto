import { Hono } from 'hono'
import { setCookie, deleteCookie } from 'hono/cookie'
import { z } from 'zod'
import { signJwt } from '../lib/jwt'
import { generateMagicLinkToken, hashMagicLinkToken } from '../lib/tokens'
import { magicLinkEmail, sendEmail } from '../lib/email'
import { ulid } from '../lib/ulid'
import { authMiddleware, SESSION_COOKIE, type AuthVariables } from '../middleware/auth'
import type { Env } from '../types'

const MAGIC_LINK_TTL_MS = 15 * 60 * 1000        // 15 min
const JWT_TTL_SECONDS = 14 * 24 * 60 * 60       // 14 days

export function mountAuthRoutes(parent: Hono<{ Bindings: Env; Variables: AuthVariables }>) {
  const app = new Hono<{ Bindings: Env; Variables: AuthVariables }>()

  const requestSchema = z.object({ email: z.string().email().max(254) })

  // POST /api/auth/request
  // Always returns 202 regardless of whether the email exists, to avoid
  // account-enumeration leaks.
  app.post('/request', async (c) => {
    const body = (await c.req.json().catch(() => null)) as unknown
    const parsed = requestSchema.safeParse(body)
    if (!parsed.success) {
      return c.json(
        { ok: false, error: { code: 'validation', message: 'Invalid email' }, trace_id: c.get('trace_id') },
        400,
      )
    }
    const email = parsed.data.email.toLowerCase().trim()
    const raw = generateMagicLinkToken()
    const tokenHash = await hashMagicLinkToken(raw)
    const now = Date.now()
    const ip = c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for') ?? null

    await c.env.DB.prepare(
      `INSERT INTO magic_links (token_hash, email, created_at, expires_at, requester_ip)
       VALUES (?1, ?2, ?3, ?4, ?5)`,
    )
      .bind(tokenHash, email, now, now + MAGIC_LINK_TTL_MS, ip)
      .run()

    const { subject, text, html } = magicLinkEmail(c.env.APP_URL, raw)
    try {
      await sendEmail(c.env.RESEND_API_KEY, { to: email, subject, text, html })
    } catch (err) {
      // Delivery failure is logged but not leaked back to the client.
      console.error(`[auth] email delivery failed: ${(err as Error).message}`)
    }

    return c.json({ ok: true, data: { accepted: true }, trace_id: c.get('trace_id') }, 202)
  })

  // GET /api/auth/callback?token=...
  // Exchange the OTT for a 14-day JWT cookie and redirect to "/".
  app.get('/callback', async (c) => {
    const raw = c.req.query('token')
    if (!raw || raw.length !== 64) {
      return c.redirect('/login?error=invalid', 302)
    }
    const tokenHash = await hashMagicLinkToken(raw)
    const row = await c.env.DB.prepare(
      `SELECT email, expires_at, consumed_at FROM magic_links WHERE token_hash = ?1`,
    )
      .bind(tokenHash)
      .first<{ email: string; expires_at: number; consumed_at: number | null }>()

    if (!row || row.consumed_at || row.expires_at < Date.now()) {
      return c.redirect('/login?error=expired', 302)
    }

    // Mark the token as consumed atomically before issuing the JWT.
    const consumed = await c.env.DB.prepare(
      `UPDATE magic_links SET consumed_at = ?1 WHERE token_hash = ?2 AND consumed_at IS NULL`,
    )
      .bind(Date.now(), tokenHash)
      .run()
    if (consumed.meta.changes !== 1) {
      return c.redirect('/login?error=expired', 302)
    }

    // Upsert the user.
    const existing = await c.env.DB.prepare(`SELECT id FROM users WHERE email = ?1`)
      .bind(row.email)
      .first<{ id: string }>()
    let userId: string
    if (existing) {
      userId = existing.id
      await c.env.DB.prepare(`UPDATE users SET last_login_at = ?1 WHERE id = ?2`)
        .bind(Date.now(), userId)
        .run()
    } else {
      userId = ulid()
      await c.env.DB.prepare(
        `INSERT INTO users (id, email, created_at, last_login_at, plan) VALUES (?1, ?2, ?3, ?3, 'free')`,
      )
        .bind(userId, row.email, Date.now())
        .run()
    }

    const jwt = await signJwt({ sub: userId, email: row.email }, c.env.JWT_SECRET, JWT_TTL_SECONDS)
    setCookie(c, SESSION_COOKIE, jwt, {
      httpOnly: true,
      secure: c.env.ENV !== 'dev',
      sameSite: 'Lax',
      path: '/',
      maxAge: JWT_TTL_SECONDS,
    })
    return c.redirect('/', 302)
  })

  // GET /api/auth/me — read-only, requires auth
  app.get('/me', authMiddleware, (c) => {
    const user = c.get('user')
    return c.json({ ok: true, data: { id: user.sub, email: user.email }, trace_id: c.get('trace_id') })
  })

  // POST /api/auth/logout — always returns 200, clears cookie
  app.post('/logout', (c) => {
    deleteCookie(c, SESSION_COOKIE, { path: '/' })
    return c.json({ ok: true, data: { cleared: true }, trace_id: c.get('trace_id') })
  })

  parent.route('/api/auth', app)
}
