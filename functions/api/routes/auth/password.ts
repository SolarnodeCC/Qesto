import { z } from 'zod'
import { generateMagicLinkToken, hashMagicLinkToken } from '../../lib/tokens'
import { readKvText, writeKvJson, deleteKv } from '../../lib/kv'
import { sendEmail } from '../../lib/email'
import { atomicRateLimitDual } from '../../lib/atomic-rate-limit'
import { ulid } from '../../lib/ulid'
import { signJwt } from '../../lib/jwt'
import { hashPassword, verifyPassword, passwordNeedsRehash } from '../../lib/password'
import { ensurePersonalTeam } from '../teams'
import {
  JWT_TTL_SECONDS,
  LOGIN_MAX_PER_EMAIL,
  LOGIN_MAX_PER_IP,
  LOGIN_WINDOW_SECONDS,
  PASSWORD_RESET_TTL_SECONDS,
} from './constants'
import { setAuthSessionCookie } from './cookie'
import { pwdKey, resetKey } from './helpers'
import { authEmailRequestSchema, passwordSchema, signupSchema } from './schemas'
import { authJsonInternalError } from './errors'
import { validateKvJson, PasswordCredentialSchema, PasswordResetSchema } from '../../lib/protocol-schemas'
import { bumpSessionEpoch } from '../../lib/session-token'
import { safeLogContext } from '../../lib/log'
import { recordAuthAuditEvent } from '../../lib/audit'
import { isDisposableEmail, DISPOSABLE_EMAIL_MESSAGE } from '../../lib/email-domain'
import { errorResponse } from '../../lib/error-handler'
import type { AuthApp } from './types'

export function registerPasswordAuthRoutes(app: AuthApp): void {
  app.post('/password/signup', async (c) => {
    const body = (await c.req.json().catch(() => null)) as unknown
    const parsed = signupSchema.safeParse(body)
    if (!parsed.success) {
      return c.json(
        { ok: false, error: { code: 'validation', message: 'Invalid input' }, trace_id: c.get('trace_id') },
        400,
      )
    }
    try {
      const { email, password, name } = parsed.data
      const normalEmail = email.toLowerCase().trim()

      // ADR-0074: refuse disposable inboxes.
      if (isDisposableEmail(c.env, normalEmail)) {
        return errorResponse(c, 400, 'validation', DISPOSABLE_EMAIL_MESSAGE)
      }

      // ADR-0074: password signup had no limiter at all — the magic-link path
      // was rate-limited but this one was open, which does not survive a public
      // free-access window. Same dual gate (L1 burst + L2 product window).
      const signupIp = c.req.header('cf-connecting-ip') ?? null
      if (signupIp) {
        const ipGate = await atomicRateLimitDual(c.env, {
          key: `ip:${signupIp}`,
          burst: 'auth_burst',
          sustained: { max: LOGIN_MAX_PER_IP, windowSeconds: LOGIN_WINDOW_SECONDS, prefix: 'auth-signup' },
          profileLabel: 'auth_signup_ip',
        })
        if (!ipGate.allowed) {
          return errorResponse(c, 429, 'rate_limited', 'Too many signups. Try again later.')
        }
      }
      const signupEmailGate = await atomicRateLimitDual(c.env, {
        key: `email:${normalEmail}`,
        burst: 'auth_burst',
        sustained: { max: LOGIN_MAX_PER_EMAIL, windowSeconds: LOGIN_WINDOW_SECONDS, prefix: 'auth-signup' },
        profileLabel: 'auth_signup_email',
      })
      if (!signupEmailGate.allowed) {
        return errorResponse(c, 429, 'rate_limited', 'Too many signups. Try again later.')
      }

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

      await c.env.DB.prepare(
        `INSERT INTO users (id, email, display_name, created_at, last_login_at, plan)
         VALUES (?1, ?2, ?3, ?4, ?5, 'free')`,
      )
        .bind(userId, normalEmail, name ?? null, now, now)
        .run()

      const passwordHash = await hashPassword(password)
      await writeKvJson(c.env.USERS_KV, pwdKey(userId), { hash: passwordHash })

      try {
        await ensurePersonalTeam(c.env.TEAMS_KV, c.env.DB, userId, normalEmail)
      } catch {
        // Non-fatal: session creation falls back to ensurePersonalTeam as well
      }

      const jwt = await signJwt({ sub: userId, email: normalEmail }, c.env.JWT_SECRET, JWT_TTL_SECONDS)
      setAuthSessionCookie(c, jwt)
      void recordAuthAuditEvent(c.env.DB, {
        action: 'auth.signup',
        actor_id: userId,
        actor_ip: c.req.header('cf-connecting-ip') ?? null,
        trace_id: c.get('trace_id'),
        subject_id: userId,
        outcome: 'success',
      })
      return c.json({ ok: true, data: { id: userId, email: normalEmail, token: jwt }, trace_id: c.get('trace_id') }, 201)
    } catch (err) {
      return authJsonInternalError(c, err, '[auth] password signup')
    }
  })

  app.post('/password/login', async (c) => {
    const body = (await c.req.json().catch(() => null)) as unknown
    const parsed = passwordSchema.safeParse(body)
    if (!parsed.success) {
      return c.json(
        { ok: false, error: { code: 'validation', message: 'Invalid input' }, trace_id: c.get('trace_id') },
        400,
      )
    }
    try {
      const { email, password } = parsed.data
      const normalEmail = email.toLowerCase().trim()

      // SEC H-1: throttle brute-force / credential-stuffing before any
      // password verification work. Trust only cf-connecting-ip (the edge sets
      // it and it cannot be spoofed); never the forwarded-for fallback.
      const rateLimitedResponse = () =>
        c.json(
          {
            ok: false,
            error: { code: 'rate_limited', message: 'Too many login attempts. Try again later.' },
            trace_id: c.get('trace_id'),
          },
          429,
        )
      const ip = c.req.header('cf-connecting-ip') ?? null
      // ADR-0073 Tier B: L1 auth_burst + L2 login window.
      if (ip) {
        const ipGate = await atomicRateLimitDual(c.env, {
          key: `ip:${ip}`,
          burst: 'auth_burst',
          sustained: {
            max: LOGIN_MAX_PER_IP,
            windowSeconds: LOGIN_WINDOW_SECONDS,
            prefix: 'auth-login',
          },
          profileLabel: 'auth_login_ip',
        })
        if (!ipGate.allowed) return rateLimitedResponse()
      }
      const emailGate = await atomicRateLimitDual(c.env, {
        key: `email:${normalEmail}`,
        burst: 'auth_burst',
        sustained: {
          max: LOGIN_MAX_PER_EMAIL,
          windowSeconds: LOGIN_WINDOW_SECONDS,
          prefix: 'auth-login',
        },
        profileLabel: 'auth_login_email',
      })
      if (!emailGate.allowed) return rateLimitedResponse()

      const user = await c.env.DB.prepare(`SELECT id FROM users WHERE email = ?1`)
        .bind(normalEmail)
        .first<{ id: string }>()

      const credRaw = user ? await readKvText(c.env.USERS_KV, pwdKey(user.id)) : null
      const cred = credRaw ? validateKvJson(credRaw, PasswordCredentialSchema) : null
      if (credRaw && !cred) {
        console.warn(JSON.stringify({ event: 'auth.kv_invalid', kind: 'password_cred', user_id: user?.id }))
      }

      const valid = cred ? await verifyPassword(password, cred.hash) : false

      if (!valid) {
        void recordAuthAuditEvent(c.env.DB, {
          action: 'auth.login_failed',
          actor_ip: c.req.header('cf-connecting-ip') ?? null,
          trace_id: c.get('trace_id'),
          subject_id: normalEmail,
          outcome: 'failure',
          detail: 'invalid_credentials',
        })
        return c.json(
          { ok: false, error: { code: 'invalid_credentials', message: 'Invalid email or password' }, trace_id: c.get('trace_id') },
          401,
        )
      }

      await c.env.DB.prepare(`UPDATE users SET last_login_at = ?1 WHERE id = ?2`)
        .bind(Date.now(), user!.id)
        .run()

      // SEC L-1: transparently upgrade legacy / weak-cost password hashes to the
      // current PBKDF2 work factor now that we hold the plaintext. Non-fatal.
      if (cred && passwordNeedsRehash(cred.hash)) {
        try {
          await writeKvJson(c.env.USERS_KV, pwdKey(user!.id), { hash: await hashPassword(password) })
        } catch {
          /* best-effort: a failed rehash must not block login */
        }
      }

      const jwt = await signJwt({ sub: user!.id, email: normalEmail }, c.env.JWT_SECRET, JWT_TTL_SECONDS)
      setAuthSessionCookie(c, jwt)
      void recordAuthAuditEvent(c.env.DB, {
        action: 'auth.login',
        actor_id: user!.id,
        actor_ip: c.req.header('cf-connecting-ip') ?? null,
        trace_id: c.get('trace_id'),
        subject_id: user!.id,
        outcome: 'success',
      })
      return c.json({ ok: true, data: { id: user!.id, email: normalEmail, token: jwt }, trace_id: c.get('trace_id') })
    } catch (err) {
      return authJsonInternalError(c, err, '[auth] password login')
    }
  })

  app.post('/password/reset-request', async (c) => {
    const body = (await c.req.json().catch(() => null)) as unknown
    const parsed = authEmailRequestSchema.safeParse(body)
    if (!parsed.success) {
      return c.json(
        { ok: false, error: { code: 'validation', message: 'Invalid email' }, trace_id: c.get('trace_id') },
        400,
      )
    }
    try {
      const email = parsed.data.email.toLowerCase().trim()

      // DD-11: this was the only auth endpoint with no limiter at all, while
      // /password/login and /password/signup each carry a dual IP+email gate.
      // Unlimited it is both an email-amplification vector (direct Resend spend,
      // and spam complaints against the shared sending domain would break
      // magic-link login for every tenant) and a brute-force-free way to probe
      // the user table. Same gate as its siblings.
      const ip = c.req.header('cf-connecting-ip') ?? null
      if (ip) {
        const ipGate = await atomicRateLimitDual(c.env, {
          key: `ip:${ip}`,
          burst: 'auth_burst',
          sustained: { max: LOGIN_MAX_PER_IP, windowSeconds: LOGIN_WINDOW_SECONDS, prefix: 'auth-reset' },
          profileLabel: 'auth_reset_ip',
        })
        if (!ipGate.allowed) {
          return errorResponse(c, 429, 'rate_limited', 'Too many requests. Try again later.')
        }
      }
      const emailGate = await atomicRateLimitDual(c.env, {
        key: `email:${email}`,
        burst: 'auth_burst',
        sustained: { max: LOGIN_MAX_PER_EMAIL, windowSeconds: LOGIN_WINDOW_SECONDS, prefix: 'auth-reset' },
        profileLabel: 'auth_reset_email',
      })
      if (!emailGate.allowed) {
        return errorResponse(c, 429, 'rate_limited', 'Too many requests. Try again later.')
      }

      const user = await c.env.DB.prepare(`SELECT id FROM users WHERE email = ?1`)
        .bind(email)
        .first<{ id: string }>()

      if (user) {
        const raw = generateMagicLinkToken()
        const tokenHash = await hashMagicLinkToken(raw)

        await writeKvJson(
          c.env.ACTIONS_KV,
          resetKey(tokenHash),
          { userId: user.id, email },
          { expirationTtl: PASSWORD_RESET_TTL_SECONDS },
        )

        const resetUrl = `${c.env.PAGES_URL}/reset-password?token=${raw}`
        // DD-11: send AFTER the response is committed. The status was already a
        // constant 202, but awaiting an outbound HTTPS call to Resend only on the
        // account-exists branch made the response time itself a reliable
        // user-existence oracle (tens to hundreds of ms). waitUntil keeps the
        // timing identical either way (ASVS V2.2.1).
        const deliver = sendEmail(c.env.RESEND_API_KEY, {
          to: email,
          subject: 'Reset your Qesto password',
          text: `Click the link to reset your password (valid 1 hour):\n\n${resetUrl}`,
          html: `<p>Click the link below to reset your Qesto password. The link is valid for 1 hour.</p><p><a href="${resetUrl}">${resetUrl}</a></p>`,
          ...(c.env.RESEND_FROM ? { from: c.env.RESEND_FROM } : {}),
        }).catch((err: unknown) => {
          safeLogContext(err, { traceId: c.get('trace_id') ?? 'unknown', route: '[auth] password/reset-email', errorClass: err instanceof Error ? err.name : 'UnknownError' })
        })
        // executionCtx is absent under the Vitest harness; fall back to a
        // floating promise there rather than throwing.
        try {
          c.executionCtx.waitUntil(deliver)
        } catch {
          void deliver
        }
      }

      return c.json({ ok: true, data: { accepted: true }, trace_id: c.get('trace_id') }, 202)
    } catch (err) {
      return authJsonInternalError(c, err, '[auth] password reset-request')
    }
  })

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
    try {
      const { token, password } = parsed.data
      const tokenHash = await hashMagicLinkToken(token)
      const kvKey = resetKey(tokenHash)

      const rawKv = await readKvText(c.env.ACTIONS_KV, kvKey)
      if (!rawKv) {
        return c.json(
          { ok: false, error: { code: 'invalid_token', message: 'Reset link invalid or expired' }, trace_id: c.get('trace_id') },
          400,
        )
      }
      const payload = validateKvJson(rawKv, PasswordResetSchema)
      if (!payload) {
        safeLogContext(new Error('corrupt_reset_token'), { traceId: c.get('trace_id') ?? 'unknown', route: '[auth] password/reset-confirm', errorClass: 'CorruptKvData' })
        return authJsonInternalError(c, new Error('corrupt_reset_token'), '[auth] password reset-confirm corrupt token')
      }
      const { userId, email } = payload

      await deleteKv(c.env.ACTIONS_KV, kvKey)

      const passwordHash = await hashPassword(password)
      await writeKvJson(c.env.USERS_KV, pwdKey(userId), { hash: passwordHash })

      // DD-09: terminate every session issued before this moment BEFORE minting
      // the new one. Without this, an attacker holding a stolen cookie kept
      // access for the remainder of the 14-day JWT lifetime — so the control
      // the victim reaches for to recover the account did not recover it.
      await bumpSessionEpoch(c.env, userId, JWT_TTL_SECONDS)

      await c.env.DB.prepare(`UPDATE users SET last_login_at = ?1 WHERE id = ?2`)
        .bind(Date.now(), userId)
        .run()

      const jwt = await signJwt({ sub: userId, email }, c.env.JWT_SECRET, JWT_TTL_SECONDS)
      setAuthSessionCookie(c, jwt)
      return c.json({ ok: true, data: { reset: true, token: jwt }, trace_id: c.get('trace_id') })
    } catch (err) {
      return authJsonInternalError(c, err, '[auth] password reset-confirm')
    }
  })
}
