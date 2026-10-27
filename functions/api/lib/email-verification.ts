/**
 * Email ownership verification (DD-10, issue #883).
 *
 * Password signup used to issue a 14-day session with no proof that the caller
 * controls the mailbox. Anyone could register `cfo@target.com`, and the moment
 * an email-keyed grant (team invite, domain join) was honoured for that account,
 * they would inherit it.
 *
 * Proof of mailbox control is consuming a magic link — the one-time token only
 * the inbox owner can read. So:
 *   * every magic-link consumption marks the address verified;
 *   * Google OAuth logins are verified (exchangeGoogleCode rejects
 *     `email_verified: false`);
 *   * password signup sends a verification magic link (24h validity) and the
 *     account stays unverified until it is opened.
 *
 * Unverified accounts keep a personal sandbox (the product still demos), but
 * `requireVerifiedEmail` blocks the surfaces where an email-claimed identity
 * could reach someone else's data or money: accepting a team invite, billing
 * checkout, and API-key creation. `EMAIL_VERIFICATION_ENFORCED = "false"` is
 * the operational kill-switch.
 */
import type { MiddlewareHandler } from 'hono'
import type { Env } from '../types'
import type { AuthVariables } from '../middleware/auth'
import { ignoreSchemaPatchError, safeLogContext } from './log'
import { errorResponse } from './error-handler'
import { generateMagicLinkToken, hashMagicLinkToken } from './tokens'
import { sendEmail, verifyEmailEmail } from './email'

/** Validity of a verification link sent at signup / on resend. */
export const VERIFICATION_LINK_TTL_MS = 24 * 60 * 60 * 1000

let columnReady: Promise<void> | null = null

/**
 * Self-heal for deploys where migration 0083 has not been applied yet (D1
 * migrations are applied manually here). The ALTER succeeds exactly once per
 * database; only that first success runs the backfill, so it is not repeated
 * by later isolates (they get "duplicate column" and skip).
 */
export function ensureEmailVerifiedColumn(db: D1Database): Promise<void> {
  if (!columnReady) {
    columnReady = (async () => {
      let added = false
      try {
        await db.prepare(`ALTER TABLE users ADD COLUMN email_verified_at INTEGER`).run()
        added = true
      } catch (err) {
        ignoreSchemaPatchError(err, 'users.email_verified_at')
      }
      if (added) await db.prepare(BACKFILL_SQL).run()
    })().catch((err) => {
      columnReady = null // retry on a later request
      throw err
    })
  }
  return columnReady
}

/** Kept in sync with migrations/0083_users_email_verified.sql. */
export const BACKFILL_SQL = `UPDATE users SET email_verified_at = (
    SELECT MIN(m.consumed_at) FROM magic_links m
     WHERE m.email = users.email AND m.consumed_at IS NOT NULL
  ) WHERE email_verified_at IS NULL`

/** Idempotent: keeps the first verification timestamp. */
export async function markEmailVerified(db: D1Database, userId: string, now = Date.now()): Promise<void> {
  await ensureEmailVerifiedColumn(db)
  await db
    .prepare(`UPDATE users SET email_verified_at = COALESCE(email_verified_at, ?1) WHERE id = ?2`)
    .bind(now, userId)
    .run()
}

export async function isEmailVerified(db: D1Database, userId: string): Promise<boolean> {
  await ensureEmailVerifiedColumn(db)
  const row = await db
    .prepare(`SELECT email_verified_at FROM users WHERE id = ?1`)
    .bind(userId)
    .first<{ email_verified_at: number | null }>()
  return typeof row?.email_verified_at === 'number'
}

export function emailVerificationEnforced(env: Pick<Env, 'EMAIL_VERIFICATION_ENFORCED'>): boolean {
  return env.EMAIL_VERIFICATION_ENFORCED !== 'false'
}

/**
 * Gate for sensitive surfaces. Mount AFTER authMiddleware. Fails closed on a
 * D1 error (the surfaces it guards are never latency-critical).
 */
export const requireVerifiedEmail: MiddlewareHandler<{ Bindings: Env; Variables: AuthVariables }> = async (
  c,
  next,
) => {
  if (!emailVerificationEnforced(c.env)) return next()
  const user = c.get('user')
  if (!user) return errorResponse(c, 401, 'unauthenticated', 'Authentication required')
  let verified: boolean
  try {
    verified = await isEmailVerified(c.env.DB, user.sub)
  } catch (err) {
    safeLogContext(err, {
      traceId: c.get('trace_id') ?? 'unknown',
      route: c.req.path,
      errorClass: 'EmailVerificationLookupError',
      statusCode: 503,
    })
    return errorResponse(c, 503, 'unavailable', 'Could not confirm your email status. Try again.')
  }
  if (!verified) {
    return errorResponse(c, 403, 'email_unverified', 'Confirm your email address to continue')
  }
  return next()
}

/** Test-only: reset the per-isolate memo. */
export function __resetEmailVerificationColumnMemo(): void {
  columnReady = null
}

/**
 * Issue a 24h verification magic link and email it. Consuming it (via the
 * normal /api/auth/callback) signs the user in AND marks the address verified.
 */
export async function sendVerificationLink(
  env: Pick<Env, 'DB' | 'API_URL' | 'RESEND_API_KEY' | 'RESEND_FROM'>,
  email: string,
  requesterIp: string | null,
  now = Date.now(),
): Promise<void> {
  const raw = generateMagicLinkToken()
  const tokenHash = await hashMagicLinkToken(raw)
  await env.DB.prepare(
    `INSERT INTO magic_links (token_hash, email, created_at, expires_at, requester_ip)
     VALUES (?1, ?2, ?3, ?4, ?5)`,
  )
    .bind(tokenHash, email, now, now + VERIFICATION_LINK_TTL_MS, requesterIp)
    .run()
  const { subject, text, html } = verifyEmailEmail(env.API_URL, raw)
  await sendEmail(env.RESEND_API_KEY, {
    to: email,
    subject,
    text,
    html,
    ...(env.RESEND_FROM ? { from: env.RESEND_FROM } : {}),
  })
}
