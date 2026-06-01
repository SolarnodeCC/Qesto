import { z } from 'zod'
import { generateMagicLinkToken, hashMagicLinkToken } from '../../lib/tokens'
import { readKvText, writeKvJson, deleteKv } from '../../lib/kv'
import { sendEmail } from '../../lib/email'
import { ulid } from '../../lib/ulid'
import { signJwt } from '../../lib/jwt'
import { hashPassword, verifyPassword } from '../../lib/password'
import { ensurePersonalTeam } from '../teams'
import { JWT_TTL_SECONDS, PASSWORD_RESET_TTL_SECONDS } from './constants'
import { setAuthSessionCookie } from './cookie'
import { pwdKey, resetKey } from './helpers'
import { authEmailRequestSchema, passwordSchema, signupSchema } from './schemas'
import { authJsonInternalError } from './errors'
import { validateKvJson, PasswordCredentialSchema, PasswordResetSchema } from '../../lib/protocol-schemas'
import { safeLogContext } from '../../lib/log'
import { recordAuthAuditEvent } from '../../lib/audit'
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
        try {
          await sendEmail(c.env.RESEND_API_KEY, {
            to: email,
            subject: 'Reset your Qesto password',
            text: `Click the link to reset your password (valid 1 hour):\n\n${resetUrl}`,
            html: `<p>Click the link below to reset your Qesto password. The link is valid for 1 hour.</p><p><a href="${resetUrl}">${resetUrl}</a></p>`,
            ...(c.env.RESEND_FROM ? { from: c.env.RESEND_FROM } : {}),
          })
        } catch (err) {
          safeLogContext(err, { traceId: c.get('trace_id') ?? 'unknown', route: '[auth] password/reset-email', errorClass: err instanceof Error ? err.name : 'UnknownError' })
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
