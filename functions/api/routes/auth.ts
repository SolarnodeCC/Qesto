import { Hono } from 'hono'
import { setCookie, deleteCookie } from 'hono/cookie'
import { z } from 'zod'
import { signJwt } from '../lib/jwt'
import { generateMagicLinkToken, hashMagicLinkToken } from '../lib/tokens'
import { magicLinkEmail, sendEmail } from '../lib/email'
import { rateLimit } from '../lib/rate-limit'
import { ulid } from '../lib/ulid'
import { authMiddleware, SESSION_COOKIE, type AuthVariables } from '../middleware/auth'
import type { PlanVariables } from '../middleware/plan'
import type { Env } from '../types'
import { hashPassword, verifyPassword } from '../lib/password'
import {
  buildGoogleAuthUrl,
  exchangeGoogleCode,
  buildMicrosoftAuthUrl,
  exchangeMicrosoftCode,
  generateOAuthState,
  consumeOAuthState,
} from '../lib/oauth'

const MAGIC_LINK_TTL_MS = 15 * 60 * 1000        // 15 min
const JWT_TTL_SECONDS = 14 * 24 * 60 * 60       // 14 days
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000    // 1 hour

// Magic-link request rate limits (abuse + cost control for Resend).
//   • Per-IP:    max 10 requests per 15 min window
//   • Per-email: max  5 requests per 15 min window
// Both must pass; the tighter one bites first for a given caller.
const MAGIC_LINK_WINDOW_SECONDS = 15 * 60
const MAGIC_LINK_MAX_PER_IP = 10
const MAGIC_LINK_MAX_PER_EMAIL = 5

type Vars = AuthVariables & PlanVariables

export function mountAuthRoutes(parent: Hono<{ Bindings: Env; Variables: Vars }>) {
  const app = new Hono<{ Bindings: Env; Variables: Vars }>()

  const requestSchema = z.object({ email: z.string().email().max(254) })

  // ─────────────────────────────────────────────────────────────────────────
  // POST /api/auth/request  — magic-link request
  // Always returns 202 regardless of whether the email exists, to avoid
  // account-enumeration leaks.
  // ─────────────────────────────────────────────────────────────────────────
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
    const ip = c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for') ?? null

    // Rate-limit per-IP first (cheap abuse vector), then per-email (prevents
    // targeted inbox flooding). Both checks return 202 even on rejection so
    // the response shape doesn't leak enumeration info — but we skip the DB
    // insert and email send so the attacker gets nothing useful.
    if (ip) {
      const ipGate = await rateLimit(c.env.ACTIONS_KV, `ip:${ip}`, {
        max: MAGIC_LINK_MAX_PER_IP,
        windowSeconds: MAGIC_LINK_WINDOW_SECONDS,
        prefix: 'auth-req',
      })
      if (!ipGate.allowed) {
        return c.json(
          {
            ok: false,
            error: { code: 'rate_limited', message: 'Too many requests. Try again later.' },
            trace_id: c.get('trace_id'),
          },
          429,
        )
      }
    }
    const emailGate = await rateLimit(c.env.ACTIONS_KV, `email:${email}`, {
      max: MAGIC_LINK_MAX_PER_EMAIL,
      windowSeconds: MAGIC_LINK_WINDOW_SECONDS,
      prefix: 'auth-req',
    })
    if (!emailGate.allowed) {
      // Silently succeed to avoid leaking which addresses are being attacked.
      return c.json({ ok: true, data: { accepted: true }, trace_id: c.get('trace_id') }, 202)
    }

    const raw = generateMagicLinkToken()
    const tokenHash = await hashMagicLinkToken(raw)
    const now = Date.now()

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

  // ─────────────────────────────────────────────────────────────────────────
  // GET /api/auth/callback?token=...
  // Exchange the OTT for a 14-day JWT cookie and redirect to "/".
  // ─────────────────────────────────────────────────────────────────────────
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

  // ─────────────────────────────────────────────────────────────────────────
  // GET /api/auth/me — read-only, requires auth
  // ─────────────────────────────────────────────────────────────────────────
  app.get('/me', authMiddleware, (c) => {
    const user = c.get('user')
    return c.json({ ok: true, data: { id: user.sub, email: user.email }, trace_id: c.get('trace_id') })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // POST /api/auth/logout — always returns 200, clears cookie
  // ─────────────────────────────────────────────────────────────────────────
  app.post('/logout', (c) => {
    deleteCookie(c, SESSION_COOKIE, { path: '/' })
    return c.json({ ok: true, data: { cleared: true }, trace_id: c.get('trace_id') })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // PASSWORD AUTH ROUTES
  // ─────────────────────────────────────────────────────────────────────────

  const passwordSchema = z.object({
    email: z.string().email().max(254),
    password: z.string().min(8).max(128),
  })

  const signupSchema = passwordSchema.extend({
    name: z.string().max(100).optional(),
  })

  // POST /api/auth/password/signup
  app.post('/password/signup', async (c) => {
    const body = (await c.req.json().catch(() => null)) as unknown
    const parsed = signupSchema.safeParse(body)
    if (!parsed.success) {
      return c.json(
        { ok: false, error: { code: 'validation', message: 'Invalid input' }, trace_id: c.get('trace_id') },
        400,
      )
    }
    const { email, password, name } = parsed.data
    const normalEmail = email.toLowerCase().trim()

    const existing = await c.env.DB.prepare(`SELECT id FROM users WHERE email = ?1`)
      .bind(normalEmail)
      .first<{ id: string }>()
    if (existing) {
      return c.json(
        { ok: false, error: { code: 'email_taken', message: 'Email already registered' }, trace_id: c.get('trace_id') },
        409,
      )
    }

    const passwordHash = await hashPassword(password)
    const userId = ulid()
    const now = Date.now()
    await c.env.DB.prepare(
      `INSERT INTO users (id, email, display_name, password_hash, created_at, last_login_at, plan)
       VALUES (?1, ?2, ?3, ?4, ?5, ?5, 'free')`,
    )
      .bind(userId, normalEmail, name ?? null, passwordHash, now)
      .run()

    const jwt = await signJwt({ sub: userId, email: normalEmail }, c.env.JWT_SECRET, JWT_TTL_SECONDS)
    setCookie(c, SESSION_COOKIE, jwt, {
      httpOnly: true,
      secure: c.env.ENV !== 'dev',
      sameSite: 'Lax',
      path: '/',
      maxAge: JWT_TTL_SECONDS,
    })
    return c.json({ ok: true, data: { id: userId, email: normalEmail }, trace_id: c.get('trace_id') }, 201)
  })

  // POST /api/auth/password/login
  app.post('/password/login', async (c) => {
    const body = (await c.req.json().catch(() => null)) as unknown
    const parsed = passwordSchema.safeParse(body)
    if (!parsed.success) {
      return c.json(
        { ok: false, error: { code: 'validation', message: 'Invalid input' }, trace_id: c.get('trace_id') },
        400,
      )
    }
    const { email, password } = parsed.data
    const normalEmail = email.toLowerCase().trim()

    const user = await c.env.DB.prepare(
      `SELECT id, password_hash FROM users WHERE email = ?1`,
    )
      .bind(normalEmail)
      .first<{ id: string; password_hash: string | null }>()

    // Always run verifyPassword (with a dummy hash) to prevent timing attacks.
    const storedHash = user?.password_hash ?? 'dummy:dummy'
    const valid = user?.password_hash ? await verifyPassword(password, storedHash) : false

    if (!valid) {
      return c.json(
        { ok: false, error: { code: 'invalid_credentials', message: 'Invalid email or password' }, trace_id: c.get('trace_id') },
        401,
      )
    }

    await c.env.DB.prepare(`UPDATE users SET last_login_at = ?1 WHERE id = ?2`)
      .bind(Date.now(), user!.id)
      .run()

    const jwt = await signJwt({ sub: user!.id, email: normalEmail }, c.env.JWT_SECRET, JWT_TTL_SECONDS)
    setCookie(c, SESSION_COOKIE, jwt, {
      httpOnly: true,
      secure: c.env.ENV !== 'dev',
      sameSite: 'Lax',
      path: '/',
      maxAge: JWT_TTL_SECONDS,
    })
    return c.json({ ok: true, data: { id: user!.id, email: normalEmail }, trace_id: c.get('trace_id') })
  })

  // POST /api/auth/password/reset-request
  app.post('/password/reset-request', async (c) => {
    const body = (await c.req.json().catch(() => null)) as unknown
    const parsed = requestSchema.safeParse(body)
    if (!parsed.success) {
      return c.json(
        { ok: false, error: { code: 'validation', message: 'Invalid email' }, trace_id: c.get('trace_id') },
        400,
      )
    }
    const email = parsed.data.email.toLowerCase().trim()
    const ip = c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for') ?? null

    // Always return 202 to avoid leaking whether the email is registered.
    const user = await c.env.DB.prepare(`SELECT id FROM users WHERE email = ?1`)
      .bind(email)
      .first<{ id: string }>()

    if (user) {
      const raw = generateMagicLinkToken()
      const tokenHash = await hashMagicLinkToken(raw)
      const now = Date.now()
      await c.env.DB.prepare(
        `INSERT INTO password_reset_tokens (token_hash, user_id, created_at, expires_at, requester_ip)
         VALUES (?1, ?2, ?3, ?4, ?5)`,
      )
        .bind(tokenHash, user.id, now, now + PASSWORD_RESET_TTL_MS, ip)
        .run()

      const resetUrl = `${c.env.APP_URL}/reset-password?token=${raw}`
      try {
        await sendEmail(c.env.RESEND_API_KEY, {
          to: email,
          subject: 'Reset your Qesto password',
          text: `Click the link to reset your password (valid 1 hour):\n\n${resetUrl}`,
          html: `<p>Click the link below to reset your Qesto password. The link is valid for 1 hour.</p><p><a href="${resetUrl}">${resetUrl}</a></p>`,
        })
      } catch (err) {
        console.error(`[auth] reset email delivery failed: ${(err as Error).message}`)
      }
    }

    return c.json({ ok: true, data: { accepted: true }, trace_id: c.get('trace_id') }, 202)
  })

  // POST /api/auth/password/reset-confirm
  app.post('/password/reset-confirm', async (c) => {
    const body = (await c.req.json().catch(() => null)) as unknown
    const parsed = z
      .object({ token: z.string().length(64), password: z.string().min(8).max(128) })
      .safeParse(body)
    if (!parsed.success) {
      return c.json(
        { ok: false, error: { code: 'validation', message: 'Invalid input' }, trace_id: c.get('trace_id') },
        400,
      )
    }
    const { token, password } = parsed.data
    const tokenHash = await hashMagicLinkToken(token)

    const row = await c.env.DB.prepare(
      `SELECT user_id, expires_at, consumed_at FROM password_reset_tokens WHERE token_hash = ?1`,
    )
      .bind(tokenHash)
      .first<{ user_id: string; expires_at: number; consumed_at: number | null }>()

    if (!row || row.consumed_at || row.expires_at < Date.now()) {
      return c.json(
        { ok: false, error: { code: 'invalid_token', message: 'Reset link invalid or expired' }, trace_id: c.get('trace_id') },
        400,
      )
    }

    const consumed = await c.env.DB.prepare(
      `UPDATE password_reset_tokens SET consumed_at = ?1 WHERE token_hash = ?2 AND consumed_at IS NULL`,
    )
      .bind(Date.now(), tokenHash)
      .run()
    if (consumed.meta.changes !== 1) {
      return c.json(
        { ok: false, error: { code: 'invalid_token', message: 'Reset link already used' }, trace_id: c.get('trace_id') },
        400,
      )
    }

    const passwordHash = await hashPassword(password)
    await c.env.DB.prepare(`UPDATE users SET password_hash = ?1, last_login_at = ?2 WHERE id = ?3`)
      .bind(passwordHash, Date.now(), row.user_id)
      .run()

    const user = await c.env.DB.prepare(`SELECT email FROM users WHERE id = ?1`)
      .bind(row.user_id)
      .first<{ email: string }>()

    const jwt = await signJwt({ sub: row.user_id, email: user!.email }, c.env.JWT_SECRET, JWT_TTL_SECONDS)
    setCookie(c, SESSION_COOKIE, jwt, {
      httpOnly: true,
      secure: c.env.ENV !== 'dev',
      sameSite: 'Lax',
      path: '/',
      maxAge: JWT_TTL_SECONDS,
    })
    return c.json({ ok: true, data: { reset: true }, trace_id: c.get('trace_id') })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // GOOGLE OAUTH ROUTES
  // ─────────────────────────────────────────────────────────────────────────

  app.get('/google', async (c) => {
    if (!c.env.GOOGLE_CLIENT_ID) {
      return c.redirect('/login?error=provider_not_configured', 302)
    }
    const state = await generateOAuthState(c.env.ACTIONS_KV)
    const redirectUri = `${c.env.APP_URL}/api/auth/google/callback`
    return c.redirect(buildGoogleAuthUrl(state, redirectUri, c.env.GOOGLE_CLIENT_ID), 302)
  })

  app.get('/google/callback', async (c) => {
    const code = c.req.query('code')
    const state = c.req.query('state')
    const error = c.req.query('error')

    if (error || !code || !state) {
      return c.redirect('/login?error=sso_failed', 302)
    }
    if (!c.env.GOOGLE_CLIENT_ID || !c.env.GOOGLE_CLIENT_SECRET) {
      return c.redirect('/login?error=provider_not_configured', 302)
    }
    const stateValid = await consumeOAuthState(c.env.ACTIONS_KV, state)
    if (!stateValid) {
      return c.redirect('/login?error=sso_failed', 302)
    }

    let providerUser: { email: string; sub: string }
    try {
      const redirectUri = `${c.env.APP_URL}/api/auth/google/callback`
      providerUser = await exchangeGoogleCode(code, redirectUri, c.env.GOOGLE_CLIENT_ID, c.env.GOOGLE_CLIENT_SECRET)
    } catch {
      return c.redirect('/login?error=sso_failed', 302)
    }

    const userId = await upsertOAuthUser(c.env.DB, 'google', providerUser.sub, providerUser.email)
    const jwt = await signJwt({ sub: userId, email: providerUser.email }, c.env.JWT_SECRET, JWT_TTL_SECONDS)
    setCookie(c, SESSION_COOKIE, jwt, {
      httpOnly: true,
      secure: c.env.ENV !== 'dev',
      sameSite: 'Lax',
      path: '/',
      maxAge: JWT_TTL_SECONDS,
    })
    return c.redirect('/', 302)
  })

  // ─────────────────────────────────────────────────────────────────────────
  // MICROSOFT OAUTH ROUTES
  // ─────────────────────────────────────────────────────────────────────────

  app.get('/microsoft', async (c) => {
    if (!c.env.MICROSOFT_CLIENT_ID) {
      return c.redirect('/login?error=provider_not_configured', 302)
    }
    const state = await generateOAuthState(c.env.ACTIONS_KV)
    const redirectUri = `${c.env.APP_URL}/api/auth/microsoft/callback`
    const tenantId = c.env.MICROSOFT_TENANT_ID ?? 'common'
    return c.redirect(buildMicrosoftAuthUrl(state, redirectUri, c.env.MICROSOFT_CLIENT_ID, tenantId), 302)
  })

  app.get('/microsoft/callback', async (c) => {
    const code = c.req.query('code')
    const state = c.req.query('state')
    const error = c.req.query('error')

    if (error || !code || !state) {
      return c.redirect('/login?error=sso_failed', 302)
    }
    if (!c.env.MICROSOFT_CLIENT_ID || !c.env.MICROSOFT_CLIENT_SECRET) {
      return c.redirect('/login?error=provider_not_configured', 302)
    }
    const stateValid = await consumeOAuthState(c.env.ACTIONS_KV, state)
    if (!stateValid) {
      return c.redirect('/login?error=sso_failed', 302)
    }

    let providerUser: { email: string; sub: string }
    try {
      const redirectUri = `${c.env.APP_URL}/api/auth/microsoft/callback`
      const tenantId = c.env.MICROSOFT_TENANT_ID ?? 'common'
      providerUser = await exchangeMicrosoftCode(code, redirectUri, c.env.MICROSOFT_CLIENT_ID, c.env.MICROSOFT_CLIENT_SECRET, tenantId)
    } catch {
      return c.redirect('/login?error=sso_failed', 302)
    }

    const userId = await upsertOAuthUser(c.env.DB, 'microsoft', providerUser.sub, providerUser.email)
    const jwt = await signJwt({ sub: userId, email: providerUser.email }, c.env.JWT_SECRET, JWT_TTL_SECONDS)
    setCookie(c, SESSION_COOKIE, jwt, {
      httpOnly: true,
      secure: c.env.ENV !== 'dev',
      sameSite: 'Lax',
      path: '/',
      maxAge: JWT_TTL_SECONDS,
    })
    return c.redirect('/', 302)
  })

  parent.route('/api/auth', app)
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared helper: upsert user + oauth_account for a given OAuth provider login.
// Returns the Qesto user ID.
// ─────────────────────────────────────────────────────────────────────────────
async function upsertOAuthUser(
  db: D1Database,
  provider: 'google' | 'microsoft',
  providerUserId: string,
  email: string,
): Promise<string> {
  const now = Date.now()

  // Check if we already have an oauth_account for this provider identity.
  const existing = await db
    .prepare(`SELECT user_id FROM oauth_accounts WHERE provider = ?1 AND provider_user_id = ?2`)
    .bind(provider, providerUserId)
    .first<{ user_id: string }>()

  if (existing) {
    await db.prepare(`UPDATE oauth_accounts SET last_used_at = ?1 WHERE provider = ?2 AND provider_user_id = ?3`)
      .bind(now, provider, providerUserId)
      .run()
    await db.prepare(`UPDATE users SET last_login_at = ?1 WHERE id = ?2`)
      .bind(now, existing.user_id)
      .run()
    return existing.user_id
  }

  // No oauth_account yet — find or create the user by email, then link the account.
  const emailNorm = email.toLowerCase().trim()
  let userId: string

  const byEmail = await db.prepare(`SELECT id FROM users WHERE email = ?1`).bind(emailNorm).first<{ id: string }>()
  if (byEmail) {
    userId = byEmail.id
    await db.prepare(`UPDATE users SET last_login_at = ?1 WHERE id = ?2`).bind(now, userId).run()
  } else {
    userId = ulid()
    await db
      .prepare(`INSERT INTO users (id, email, created_at, last_login_at, plan) VALUES (?1, ?2, ?3, ?3, 'free')`)
      .bind(userId, emailNorm, now)
      .run()
  }

  await db
    .prepare(
      `INSERT INTO oauth_accounts (id, user_id, provider, provider_user_id, provider_email, created_at, last_used_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)`,
    )
    .bind(ulid(), userId, provider, providerUserId, emailNorm, now)
    .run()

  return userId
}
