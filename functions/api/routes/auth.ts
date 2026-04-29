import { Hono } from 'hono'
import { setCookie, deleteCookie } from 'hono/cookie'
import { z } from 'zod'
import { signJwt } from '../lib/jwt'
import { generateMagicLinkToken, hashMagicLinkToken } from '../lib/tokens'
import { magicLinkEmail, sendEmail } from '../lib/email'
import { rateLimit } from '../lib/rate-limit'
import { ulid } from '../lib/ulid'
import { writeEvent } from '../lib/observability'
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
import {
  buildAuthnRequest,
  buildSpMetadata,
  consumeSamlState,
  generateSamlState,
  parseAssertion,
} from '../lib/saml'
import { attachUserToTeam, loadTeam } from './teams'

const MAGIC_LINK_TTL_MS = 15 * 60 * 1000        // 15 min
const JWT_TTL_SECONDS = 14 * 24 * 60 * 60       // 14 days
const PASSWORD_RESET_TTL_SECONDS = 60 * 60      // 1 hour

// Magic-link request rate limits (abuse + cost control for Resend).
//   • Per-IP:    max 10 requests per 15 min window
//   • Per-email: max  5 requests per 15 min window
// Both must pass; the tighter one bites first for a given caller.
const MAGIC_LINK_WINDOW_SECONDS = 15 * 60
const MAGIC_LINK_MAX_PER_IP = 10
const MAGIC_LINK_MAX_PER_EMAIL = 5

// KV key helpers — all credential/identity data lives in KV, never in D1,
// so no schema migrations are required.
//
//   USERS_KV:
//     pwd:{userId}                  → { hash: string }
//     oauth:{provider}:{sub}        → { userId: string; email: string }
//
//   ACTIONS_KV:
//     pwd-reset:{tokenHash}         → { userId: string; email: string }
//                                     (written with expirationTtl = 3600)
const pwdKey  = (userId: string) => `pwd:${userId}`
const oauthKey = (provider: string, sub: string) => `oauth:${provider}:${sub}`
const resetKey = (tokenHash: string) => `pwd-reset:${tokenHash}`

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

    const { subject, text, html } = magicLinkEmail(c.env.API_URL, raw)
    try {
      await sendEmail(c.env.RESEND_API_KEY, {
        to: email,
        subject,
        text,
        html,
        ...(c.env.RESEND_FROM ? { from: c.env.RESEND_FROM } : {}),
      })
    } catch (err) {
      console.error(`[auth] email delivery failed: ${(err as Error).message}`)
    }

    return c.json({ ok: true, data: { accepted: true }, trace_id: c.get('trace_id') }, 202)
  })

  // ─────────────────────────────────────────────────────────────────────────
  // GET /api/auth/callback?token=...
  // ─────────────────────────────────────────────────────────────────────────
  app.get('/callback', async (c) => {
    const raw = c.req.query('token')
    if (!raw || raw.length !== 64) {
      return c.redirect(`${c.env.PAGES_URL}/login?error=invalid`, 302)
    }
    const tokenHash = await hashMagicLinkToken(raw)
    const row = await c.env.DB.prepare(
      `SELECT email, expires_at, consumed_at FROM magic_links WHERE token_hash = ?1`,
    )
      .bind(tokenHash)
      .first<{ email: string; expires_at: number; consumed_at: number | null }>()

    if (!row || row.consumed_at || row.expires_at < Date.now()) {
      return c.redirect(`${c.env.PAGES_URL}/login?error=expired`, 302)
    }

    const consumed = await c.env.DB.prepare(
      `UPDATE magic_links SET consumed_at = ?1 WHERE token_hash = ?2 AND consumed_at IS NULL`,
    )
      .bind(Date.now(), tokenHash)
      .run()
    if (consumed.meta.changes !== 1) {
      return c.redirect(`${c.env.PAGES_URL}/login?error=expired`, 302)
    }

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
      const now = Date.now()
      await c.env.DB.prepare(
        `INSERT INTO users (id, email, created_at, last_login_at, plan) VALUES (?1, ?2, ?3, ?4, 'free')`,
      )
        .bind(userId, row.email, now, now)
        .run()
      writeEvent(c.env.METRICS_AE, {
        name: 'signup',
        userId,
        plan: 'free',
        traceId: c.get('trace_id'),
      })
    }

    const jwt = await signJwt({ sub: userId, email: row.email }, c.env.JWT_SECRET, JWT_TTL_SECONDS)
    setCookie(c, SESSION_COOKIE, jwt, {
      httpOnly: true,
      secure: true,
      sameSite: 'None',
      path: '/',
      maxAge: JWT_TTL_SECONDS,
    })
    return c.redirect(`${c.env.PAGES_URL}/`, 302)
  })

  // ─────────────────────────────────────────────────────────────────────────
  // GET /api/auth/me
  // ─────────────────────────────────────────────────────────────────────────
  app.get('/me', authMiddleware, (c) => {
    const user = c.get('user')
    return c.json({ ok: true, data: { id: user.sub, email: user.email }, trace_id: c.get('trace_id') })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // POST /api/auth/logout
  // ─────────────────────────────────────────────────────────────────────────
  app.post('/logout', (c) => {
    deleteCookie(c, SESSION_COOKIE, { path: '/' })
    return c.json({ ok: true, data: { cleared: true }, trace_id: c.get('trace_id') })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // PASSWORD AUTH ROUTES
  // Password hashes live in USERS_KV under pwd:{userId} — no D1 changes.
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

    const userId = ulid()
    const now = Date.now()

    // Create the user row — same INSERT as magic-link (no password_hash column).
    await c.env.DB.prepare(
      `INSERT INTO users (id, email, display_name, created_at, last_login_at, plan)
       VALUES (?1, ?2, ?3, ?4, ?5, 'free')`,
    )
      .bind(userId, normalEmail, name ?? null, now, now)
      .run()

    // Store password hash in KV, not D1.
    const passwordHash = await hashPassword(password)
    await c.env.USERS_KV.put(pwdKey(userId), JSON.stringify({ hash: passwordHash }))

    const jwt = await signJwt({ sub: userId, email: normalEmail }, c.env.JWT_SECRET, JWT_TTL_SECONDS)
    setCookie(c, SESSION_COOKIE, jwt, {
      httpOnly: true,
      secure: true,
      sameSite: 'None',
      path: '/',
      maxAge: JWT_TTL_SECONDS,
    })
    return c.json({ ok: true, data: { id: userId, email: normalEmail, token: jwt }, trace_id: c.get('trace_id') }, 201)
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

    const user = await c.env.DB.prepare(`SELECT id FROM users WHERE email = ?1`)
      .bind(normalEmail)
      .first<{ id: string }>()

    // Look up the password hash from KV (null = user exists but has no password).
    const credRaw = user ? await c.env.USERS_KV.get(pwdKey(user.id)) : null
    let cred: { hash: string } | null = null
    if (credRaw) {
      try {
        cred = JSON.parse(credRaw) as { hash: string }
      } catch (parseErr) {
        console.warn(`[auth] failed to parse password credential for user ${user?.id}:`, parseErr)
      }
    }

    // Always run verifyPassword with a dummy hash to prevent timing attacks.
    const valid = cred ? await verifyPassword(password, cred.hash) : false

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
      secure: true,
      sameSite: 'None',
      path: '/',
      maxAge: JWT_TTL_SECONDS,
    })
    return c.json({ ok: true, data: { id: user!.id, email: normalEmail, token: jwt }, trace_id: c.get('trace_id') })
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

    const user = await c.env.DB.prepare(`SELECT id FROM users WHERE email = ?1`)
      .bind(email)
      .first<{ id: string }>()

    if (user) {
      const raw = generateMagicLinkToken()
      const tokenHash = await hashMagicLinkToken(raw)

      // Store reset token in ACTIONS_KV with 1-hour TTL — no D1 table needed.
      await c.env.ACTIONS_KV.put(
        resetKey(tokenHash),
        JSON.stringify({ userId: user.id, email }),
        { expirationTtl: PASSWORD_RESET_TTL_SECONDS },
      )

      const resetUrl = `${c.env.PAGES_URL}/reset-password?token=${raw}`
      try {
        await sendEmail(c.env.RESEND_API_KEY, {
          to: email,
          subject: 'Reset your Qesto password',
          text: `Click the link to reset your password (valid 1 hour):\n\n${resetUrl}`,
          html: `<p>Click the link below to reset your Qesto password. The link is valid for 1 hour.</p><p><a href="${resetUrl}">${resetUrl}</a></p>`,
          ...(c.env.RESEND_FROM ? { from: c.env.RESEND_FROM } : {}),
        })
      } catch (err) {
        console.error(`[auth] reset email delivery failed: ${(err as Error).message}`)
      }
    }

    // Always 202 to avoid leaking whether the email is registered.
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
    const kvKey = resetKey(tokenHash)

    const raw = await c.env.ACTIONS_KV.get(kvKey)
    if (!raw) {
      return c.json(
        { ok: false, error: { code: 'invalid_token', message: 'Reset link invalid or expired' }, trace_id: c.get('trace_id') },
        400,
      )
    }
    let userId: string, email: string
    try {
      const parsed = JSON.parse(raw) as { userId: string; email: string }
      userId = parsed.userId
      email = parsed.email
    } catch (parseErr) {
      console.error('[auth] failed to parse reset token data:', parseErr)
      return c.json(
        { ok: false, error: { code: 'internal', message: 'Reset link corrupted' }, trace_id: c.get('trace_id') },
        500,
      )
    }

    // Consume the token immediately — delete before updating password.
    await c.env.ACTIONS_KV.delete(kvKey)

    const passwordHash = await hashPassword(password)
    await c.env.USERS_KV.put(pwdKey(userId), JSON.stringify({ hash: passwordHash }))

    await c.env.DB.prepare(`UPDATE users SET last_login_at = ?1 WHERE id = ?2`)
      .bind(Date.now(), userId)
      .run()

    const jwt = await signJwt({ sub: userId, email }, c.env.JWT_SECRET, JWT_TTL_SECONDS)
    setCookie(c, SESSION_COOKIE, jwt, {
      httpOnly: true,
      secure: true,
      sameSite: 'None',
      path: '/',
      maxAge: JWT_TTL_SECONDS,
    })
    return c.json({ ok: true, data: { reset: true, token: jwt }, trace_id: c.get('trace_id') })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // GOOGLE OAUTH ROUTES
  // OAuth identities stored in USERS_KV under oauth:{provider}:{sub}.
  // ─────────────────────────────────────────────────────────────────────────

  app.get('/google', async (c) => {
    if (!c.env.GOOGLE_CLIENT_ID) {
      return c.redirect(`${c.env.PAGES_URL}/login?error=provider_not_configured`, 302)
    }
    const state = await generateOAuthState(c.env.ACTIONS_KV)
    const redirectUri = `${c.env.API_URL}/api/auth/google/callback`
    return c.redirect(buildGoogleAuthUrl(state, redirectUri, c.env.GOOGLE_CLIENT_ID), 302)
  })

  app.get('/google/callback', async (c) => {
    const code = c.req.query('code')
    const state = c.req.query('state')
    const error = c.req.query('error')

    if (error || !code || !state) return c.redirect(`${c.env.PAGES_URL}/login?error=sso_failed`, 302)
    if (!c.env.GOOGLE_CLIENT_ID || !c.env.GOOGLE_CLIENT_SECRET) {
      return c.redirect(`${c.env.PAGES_URL}/login?error=provider_not_configured`, 302)
    }
    if (!(await consumeOAuthState(c.env.ACTIONS_KV, state))) {
      return c.redirect(`${c.env.PAGES_URL}/login?error=sso_failed`, 302)
    }

    let providerUser: { email: string; sub: string }
    try {
      providerUser = await exchangeGoogleCode(
        code,
        `${c.env.API_URL}/api/auth/google/callback`,
        c.env.GOOGLE_CLIENT_ID,
        c.env.GOOGLE_CLIENT_SECRET,
      )
    } catch {
      return c.redirect(`${c.env.PAGES_URL}/login?error=sso_failed`, 302)
    }

    const userId = await upsertOAuthUser(c.env.DB, c.env.USERS_KV, 'google', providerUser.sub, providerUser.email)
    const jwt = await signJwt({ sub: userId, email: providerUser.email }, c.env.JWT_SECRET, JWT_TTL_SECONDS)
    setCookie(c, SESSION_COOKIE, jwt, {
      httpOnly: true,
      secure: true,
      sameSite: 'None',
      path: '/',
      maxAge: JWT_TTL_SECONDS,
    })
    return c.redirect(`${c.env.PAGES_URL}/`, 302)
  })

  // ─────────────────────────────────────────────────────────────────────────
  // MICROSOFT OAUTH ROUTES
  // ─────────────────────────────────────────────────────────────────────────

  app.get('/microsoft', async (c) => {
    if (!c.env.MICROSOFT_CLIENT_ID) {
      return c.redirect(`${c.env.PAGES_URL}/login?error=provider_not_configured`, 302)
    }
    const state = await generateOAuthState(c.env.ACTIONS_KV)
    const redirectUri = `${c.env.API_URL}/api/auth/microsoft/callback`
    const tenantId = c.env.MICROSOFT_TENANT_ID ?? 'common'
    return c.redirect(buildMicrosoftAuthUrl(state, redirectUri, c.env.MICROSOFT_CLIENT_ID, tenantId), 302)
  })

  app.get('/microsoft/callback', async (c) => {
    const code = c.req.query('code')
    const state = c.req.query('state')
    const error = c.req.query('error')

    if (error || !code || !state) return c.redirect(`${c.env.PAGES_URL}/login?error=sso_failed`, 302)
    if (!c.env.MICROSOFT_CLIENT_ID || !c.env.MICROSOFT_CLIENT_SECRET) {
      return c.redirect(`${c.env.PAGES_URL}/login?error=provider_not_configured`, 302)
    }
    if (!(await consumeOAuthState(c.env.ACTIONS_KV, state))) {
      return c.redirect(`${c.env.PAGES_URL}/login?error=sso_failed`, 302)
    }

    let providerUser: { email: string; sub: string }
    try {
      const tenantId = c.env.MICROSOFT_TENANT_ID ?? 'common'
      providerUser = await exchangeMicrosoftCode(
        code,
        `${c.env.API_URL}/api/auth/microsoft/callback`,
        c.env.MICROSOFT_CLIENT_ID,
        c.env.MICROSOFT_CLIENT_SECRET,
        tenantId,
      )
    } catch {
      return c.redirect(`${c.env.PAGES_URL}/login?error=sso_failed`, 302)
    }

    const userId = await upsertOAuthUser(c.env.DB, c.env.USERS_KV, 'microsoft', providerUser.sub, providerUser.email)
    const jwt = await signJwt({ sub: userId, email: providerUser.email }, c.env.JWT_SECRET, JWT_TTL_SECONDS)
    setCookie(c, SESSION_COOKIE, jwt, {
      httpOnly: true,
      secure: true,
      sameSite: 'None',
      path: '/',
      maxAge: JWT_TTL_SECONDS,
    })
    return c.redirect(`${c.env.PAGES_URL}/`, 302)
  })

  // ─────────────────────────────────────────────────────────────────────────
  // SAML SSO ROUTES
  // Service Provider-initiated login against a team's configured IdP.
  // ─────────────────────────────────────────────────────────────────────────

  // GET /api/auth/saml/metadata — SP metadata XML for upload to IdPs.
  app.get('/saml/metadata', (c) => {
    const entityId = c.env.SAML_SP_ENTITY_ID ?? `${c.env.API_URL}`
    const acsUrl = c.env.SAML_ACS_URL ?? `${c.env.API_URL}/api/auth/saml/callback`
    const xml = buildSpMetadata(entityId, acsUrl)
    return new Response(xml, {
      status: 200,
      headers: {
        'content-type': 'application/samlmetadata+xml; charset=utf-8',
        'x-trace-id': c.get('trace_id'),
      },
    })
  })

  // GET /api/auth/saml/init?team_id=... — redirect to IdP with AuthnRequest.
  app.get('/saml/init', async (c) => {
    const teamId = c.req.query('team_id')
    if (!teamId) {
      return c.redirect(`${c.env.PAGES_URL}/login?error=saml_team_required`, 302)
    }
    const team = await loadTeam(c.env.TEAMS_KV, teamId)
    if (!team || !team.samlConfig) {
      return c.redirect(`${c.env.PAGES_URL}/login?error=saml_not_configured`, 302)
    }

    const entityId = c.env.SAML_SP_ENTITY_ID ?? `${c.env.API_URL}`
    const acsUrl = c.env.SAML_ACS_URL ?? `${c.env.API_URL}/api/auth/saml/callback`
    const idpSsoUrl = team.samlConfig.idpSsoUrl

    // Store state token in ACTIONS_KV (5 min TTL, single-use) so the callback
    // can look up which team the response belongs to.
    const relayState = await generateSamlState(c.env.ACTIONS_KV, teamId, idpSsoUrl)
    const samlRequest = buildAuthnRequest(entityId, acsUrl, idpSsoUrl)

    const sep = idpSsoUrl.includes('?') ? '&' : '?'
    const redirect = `${idpSsoUrl}${sep}SAMLRequest=${samlRequest}&RelayState=${encodeURIComponent(relayState)}`
    return c.redirect(redirect, 302)
  })

  // POST /api/auth/saml/callback — parse assertion, upsert user, issue JWT.
  app.post('/saml/callback', async (c) => {
    const form = await c.req.formData().catch(() => null)
    if (!form) return c.redirect(`${c.env.PAGES_URL}/login?error=saml_failed`, 302)

    const samlResponse = form.get('SAMLResponse')
    const relayState = form.get('RelayState')
    if (typeof samlResponse !== 'string' || typeof relayState !== 'string') {
      return c.redirect(`${c.env.PAGES_URL}/login?error=saml_failed`, 302)
    }

    const state = await consumeSamlState(c.env.ACTIONS_KV, relayState)
    if (!state) return c.redirect(`${c.env.PAGES_URL}/login?error=saml_replay`, 302)

    const expectedAudience = c.env.SAML_SP_ENTITY_ID ?? `${c.env.API_URL}`
    let assertion: { email: string; nameId: string }
    try {
      assertion = parseAssertion(samlResponse, expectedAudience)
    } catch (err) {
      console.error(`[auth:saml] assertion parse failed: ${(err as Error).message}`)
      return c.redirect(`${c.env.PAGES_URL}/login?error=saml_invalid`, 302)
    }

    const email = assertion.email
    const now = Date.now()

    // Upsert user in D1 (same pattern as magic-link / OAuth callback).
    const existing = await c.env.DB.prepare(`SELECT id FROM users WHERE email = ?1`)
      .bind(email)
      .first<{ id: string }>()
    let userId: string
    if (existing) {
      userId = existing.id
      await c.env.DB.prepare(`UPDATE users SET last_login_at = ?1 WHERE id = ?2`).bind(now, userId).run()
    } else {
      userId = ulid()
      await c.env.DB
        .prepare(`INSERT INTO users (id, email, created_at, last_login_at, plan) VALUES (?1, ?2, ?3, ?3, 'team')`)
        .bind(userId, email, now)
        .run()
    }

    // Attach to the team that initiated the SAML flow.
    await attachUserToTeam(c.env.TEAMS_KV, c.env.DB, state.teamId, userId, email, 'member')

    const jwt = await signJwt({ sub: userId, email }, c.env.JWT_SECRET, JWT_TTL_SECONDS)
    setCookie(c, SESSION_COOKIE, jwt, {
      httpOnly: true,
      secure: true,
      sameSite: 'None',
      path: '/',
      maxAge: JWT_TTL_SECONDS,
    })
    return c.redirect(`${c.env.PAGES_URL}/`, 302)
  })

  parent.route('/api/auth', app)
}

// Upsert a user from an OAuth provider login.
// Identity link stored in USERS_KV, not a D1 table.
async function upsertOAuthUser(
  db: D1Database,
  kv: KVNamespace,
  provider: 'google' | 'microsoft',
  providerSub: string,
  email: string,
): Promise<string> {
  const now = Date.now()
  const key = oauthKey(provider, providerSub)

  const stored = await kv.get(key)
  if (stored) {
    try {
      const { userId } = JSON.parse(stored) as { userId: string }
      await db.prepare(`UPDATE users SET last_login_at = ?1 WHERE id = ?2`).bind(now, userId).run()
      return userId
    } catch (parseErr) {
      console.warn(`[auth] failed to parse oauth state for ${provider}/${providerSub}:`, parseErr)
      // Fall through to create new user
    }
  }

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

  await kv.put(key, JSON.stringify({ userId, email: emailNorm }))
  return userId
}
