import { generateMagicLinkToken, hashMagicLinkToken } from '../../lib/tokens'
import { magicLinkEmail, sendEmail } from '../../lib/email'
import { rateLimit } from '../../lib/rate-limit'
import { ulid } from '../../lib/ulid'
import { writeEvent } from '../../lib/observability'
import { signJwt } from '../../lib/jwt'
import { ensurePersonalTeam } from '../teams'
import {
  JWT_TTL_SECONDS,
  MAGIC_LINK_MAX_PER_EMAIL,
  MAGIC_LINK_MAX_PER_IP,
  MAGIC_LINK_TTL_MS,
  MAGIC_LINK_WINDOW_SECONDS,
} from './constants'
import { setAuthSessionCookie } from './cookie'
import { authEmailRequestSchema } from './schemas'
import { authJsonInternalError, authRedirectLoginServerError } from './errors'
import { safeLogContext } from '../../lib/log'
import { recordAuthAuditEvent } from '../../lib/audit'
import type { AuthApp } from './types'

export function registerMagicLinkRoutes(app: AuthApp): void {
  app.post('/request', async (c) => {
    try {
      const body = (await c.req.json().catch(() => null)) as unknown
      const parsed = authEmailRequestSchema.safeParse(body)
      if (!parsed.success) {
        return c.json(
          { ok: false, error: { code: 'validation', message: 'Invalid email' }, trace_id: c.get('trace_id') },
          400,
        )
      }
      const email = parsed.data.email.toLowerCase().trim()
      // SEC M-6: trust only the unspoofable edge header for rate-limit keys.
      const ip = c.req.header('cf-connecting-ip') ?? null

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
        safeLogContext(err, { traceId: c.get('trace_id') ?? 'unknown', route: '[auth] magic-link/email', errorClass: err instanceof Error ? err.name : 'UnknownError' })
      }

      void recordAuthAuditEvent(c.env.DB, {
        action: 'auth.magic_link_requested',
        actor_ip: ip ?? null,
        trace_id: c.get('trace_id'),
        subject_id: email,
        outcome: 'success',
      })
      return c.json({ ok: true, data: { accepted: true }, trace_id: c.get('trace_id') }, 202)
    } catch (err) {
      return authJsonInternalError(c, err, '[auth] magic-link request')
    }
  })

  app.get('/callback', async (c) => {
    const raw = c.req.query('token')
    if (!raw || raw.length !== 64) {
      return c.redirect(`${c.env.PAGES_URL}/login?error=invalid`, 302)
    }
    try {
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
        try {
          await ensurePersonalTeam(c.env.TEAMS_KV, c.env.DB, userId, row.email)
        } catch {
          // Non-fatal: session creation falls back to ensurePersonalTeam as well
        }
      }

      const jwt = await signJwt({ sub: userId, email: row.email }, c.env.JWT_SECRET, JWT_TTL_SECONDS)
      setAuthSessionCookie(c, jwt)
      void recordAuthAuditEvent(c.env.DB, {
        action: 'auth.magic_link_consumed',
        actor_id: userId,
        actor_ip: c.req.header('cf-connecting-ip') ?? null,
        trace_id: c.get('trace_id'),
        subject_id: userId,
        outcome: 'success',
      })
      return c.redirect(`${c.env.PAGES_URL}/`, 302)
    } catch (err) {
      return authRedirectLoginServerError(c, err, '[auth] magic-link callback')
    }
  })
}
